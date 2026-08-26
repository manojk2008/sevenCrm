import { ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { EnquiryStage, QuotationStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { SalesPeriodQueryDto } from './dto/sales-period-query.dto';
import { RevenueBreakdownQueryDto } from './dto/revenue-breakdown-query.dto';
import { ListLostEnquiriesQueryDto } from './dto/list-lost-enquiries-query.dto';

type CurrentUser = AppSession['user'];

// ---------------------------------------------------------------------------
// Revenue definitions (approved Phase 7C decision D1) — fixed in one place so
// no endpoint can quietly diverge from another.
//
//   Net Accepted Revenue = SUM(subtotal - discountAmount)  over ACCEPTED
//   Gross Accepted Value = SUM(grandTotal)                 over ACCEPTED
//
// Both operate exclusively on quotations whose status is ACCEPTED — the only
// QuotationStatus value that represents commercially won business. DRAFT and
// SENT are never counted as revenue; they are reported separately as open
// pipeline. Both figures are read from columns QuotationsService already
// computed and persisted with Decimal-safe arithmetic; nothing is
// recalculated here from a live Product.price.
//
// The two reconcile by construction, since
//   grandTotal = subtotal - discountAmount + taxAmount
// so gross minus net is exactly the tax component.
// ---------------------------------------------------------------------------

/** The statuses that represent a quotation that has reached a final outcome. */
const DECIDED_STATUSES: QuotationStatus[] = [
  QuotationStatus.ACCEPTED,
  QuotationStatus.REJECTED,
  QuotationStatus.EXPIRED,
];

/** The statuses that represent a quotation still out with the customer. */
const OPEN_STATUSES: QuotationStatus[] = [QuotationStatus.DRAFT, QuotationStatus.SENT];

const DEFAULT_BREAKDOWN_LIMIT = 10;

/**
 * Label used for quotation line items with no catalog Product behind them
 * (productId = null). Never given a fabricated product id.
 */
export const AD_HOC_PRODUCT_LABEL = 'Ad-hoc / custom lines';

/**
 * Every Sales figure that is filtered by a period is filtered on a *raised*
 * date, never an acceptance/close date — the database records no acceptance
 * timestamp. Carried in each response so the UI cannot mislabel it.
 */
export type SalesPeriodBasis = 'QUOTATION_CREATED_AT' | 'ENQUIRY_CREATED_AT';

export interface SafeSalesPeriod {
  from: Date | null;
  to: Date | null;
  basis: SalesPeriodBasis;
}

/**
 * A metric the mock Sales UI used to display that the current database
 * genuinely cannot support. Returned by the API (rather than hardcoded in the
 * frontend) so the UI renders an honest "unavailable" state with the real
 * reason instead of a fabricated number or a misleading zero.
 */
export interface SafeUnavailableMetric {
  key: string;
  label: string;
  reason: string;
}

export interface SafeQuotationStatusBucket {
  status: QuotationStatus;
  count: number;
  netValue: number;
  grossValue: number;
}

export interface SafeEnquiryStageBucket {
  stage: EnquiryStage;
  count: number;
  /** Sum of Enquiry.expectedRevenue — a user-entered forecast, not revenue. */
  expectedRevenue: number;
}

export interface SafeSalesSummary {
  period: SafeSalesPeriod;
  revenue: {
    netAcceptedRevenue: number;
    grossAcceptedValue: number;
    acceptedQuotationCount: number;
    /** netAcceptedRevenue / acceptedQuotationCount; 0 when the count is 0. */
    averageAcceptedValue: number;
    /** Gross value of DRAFT + SENT quotations. Not revenue. */
    openPipelineValue: number;
    openQuotationCount: number;
  };
  quotationAcceptanceRate: {
    /** Percentage 0-100, 1 decimal place. 0 when nothing is decided yet. */
    rate: number;
    accepted: number;
    /** ACCEPTED + REJECTED + EXPIRED. DRAFT/SENT are still open. */
    decided: number;
  };
  quotationStatusBreakdown: SafeQuotationStatusBucket[];
  enquiryConversion: {
    won: number;
    lost: number;
    open: number;
    total: number;
    /** won / (won + lost) as a percentage, 1dp. 0 when neither exists. */
    winRate: number;
    /** Forecast only — the sum of a user-entered field. Never realized revenue. */
    wonExpectedRevenue: number;
  };
  enquiryStageBreakdown: SafeEnquiryStageBucket[];
  unavailableMetrics: SafeUnavailableMetric[];
}

export interface SafeRevenuePeriodBucket {
  /** First instant of the UTC month this bucket covers. */
  periodStart: Date;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface SafeRevenueByPeriod {
  period: SafeSalesPeriod;
  granularity: 'MONTH';
  buckets: SafeRevenuePeriodBucket[];
}

export interface SafeRevenueByClient {
  clientId: string;
  companyName: string;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface SafeRevenueByRepresentative {
  /** Null for quotations with no assignee — reported, never dropped. */
  userId: string | null;
  name: string;
  email: string | null;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface SafeRevenueByProduct {
  /** Null for ad-hoc/custom lines. No product id is ever invented for them. */
  productId: string | null;
  productName: string;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  quantity: number;
  lineItemCount: number;
}

export interface SafeLostEnquiry {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  assignedTo: { id: string; name: string; email: string } | null;
  /** Free text as the user wrote it — never bucketed into invented categories. */
  lostReason: string | null;
  expectedRevenue: number;
  createdAt: Date;
}

export interface PaginatedLostEnquiries {
  data: SafeLostEnquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Row shapes returned by the two $queryRaw aggregations below. Postgres
// returns numeric as Prisma.Decimal and count() as bigint, so both are
// converted explicitly before leaving this service (a raw BigInt would throw
// on JSON serialization).
interface RevenuePeriodRow {
  periodStart: Date;
  net: Prisma.Decimal | null;
  gross: Prisma.Decimal | null;
  quotationCount: bigint;
}

interface RevenueProductRow {
  productId: string | null;
  net: Prisma.Decimal | null;
  gross: Prisma.Decimal | null;
  quantity: Prisma.Decimal | null;
  lineItemCount: bigint;
}

@Injectable()
export class SalesService {
  // ---------------------------------------------------------------------
  // Sales is a read-only aggregation layer over Enquiry / Quotation /
  // QuotationLineItem / Product / Client / User. It owns no table, writes
  // nothing, and exposes no mutation — so, unlike every other service in
  // this codebase, it deliberately has no `mapWriteError`: there is no write
  // path that could raise a Prisma error to translate.
  // ---------------------------------------------------------------------

  async getSummary(currentUser: CurrentUser, query: SalesPeriodQueryDto): Promise<SafeSalesSummary> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const createdAt = this.createdAtFilter(query.from, query.to);
    // Sales Executive revenue rule (Phase 19): revenue is scoped to clients
    // CURRENTLY assigned to the caller, never quotation.assignedToId /
    // enquiry.assignedToId. Additive to organizationId, never a replacement.
    const clientOwnershipFilter = isSalesExec ? { client: { assignedToId: currentUser.id } } : {};

    // Two grouped queries for the entire summary — no per-status or
    // per-stage round trip, and no N+1.
    const [quotationGroups, enquiryGroups] = await Promise.all([
      prisma.quotation.groupBy({
        by: ['status'],
        where: { organizationId, ...clientOwnershipFilter, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
        _sum: { subtotal: true, discountAmount: true, grandTotal: true },
      }),
      prisma.enquiry.groupBy({
        by: ['stage'],
        where: { organizationId, ...clientOwnershipFilter, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
        _sum: { expectedRevenue: true },
      }),
    ]);

    // Zero-filled so the shape is stable: a status/stage with no rows is
    // reported as 0, never omitted, so the UI never has to guess.
    const quotationStatusBreakdown: SafeQuotationStatusBucket[] = Object.values(
      QuotationStatus,
    ).map((status) => {
      const row = quotationGroups.find((group) => group.status === status);
      const subtotal = this.decimalToNumber(row?._sum.subtotal);
      const discount = this.decimalToNumber(row?._sum.discountAmount);
      return {
        status,
        count: row?._count._all ?? 0,
        netValue: this.round2(subtotal - discount),
        grossValue: this.decimalToNumber(row?._sum.grandTotal),
      };
    });

    const byStatus = new Map(quotationStatusBreakdown.map((bucket) => [bucket.status, bucket]));
    const accepted = byStatus.get(QuotationStatus.ACCEPTED)!;

    const decided = DECIDED_STATUSES.reduce(
      (sum, status) => sum + (byStatus.get(status)?.count ?? 0),
      0,
    );
    const openBuckets = OPEN_STATUSES.map((status) => byStatus.get(status)!);

    const enquiryStageBreakdown: SafeEnquiryStageBucket[] = Object.values(EnquiryStage).map(
      (stage) => {
        const row = enquiryGroups.find((group) => group.stage === stage);
        return {
          stage,
          count: row?._count._all ?? 0,
          expectedRevenue: this.decimalToNumber(row?._sum.expectedRevenue),
        };
      },
    );

    const byStage = new Map(enquiryStageBreakdown.map((bucket) => [bucket.stage, bucket]));
    const won = byStage.get(EnquiryStage.WON)!;
    const lost = byStage.get(EnquiryStage.LOST)!;
    const totalEnquiries = enquiryStageBreakdown.reduce((sum, bucket) => sum + bucket.count, 0);

    return {
      period: this.toSafePeriod(query.from, query.to, 'QUOTATION_CREATED_AT'),
      revenue: {
        netAcceptedRevenue: accepted.netValue,
        grossAcceptedValue: accepted.grossValue,
        acceptedQuotationCount: accepted.count,
        averageAcceptedValue:
          accepted.count > 0 ? this.round2(accepted.netValue / accepted.count) : 0,
        openPipelineValue: this.round2(
          openBuckets.reduce((sum, bucket) => sum + bucket.grossValue, 0),
        ),
        openQuotationCount: openBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
      },
      quotationAcceptanceRate: {
        // Decided-only denominator (approved decision D2): DRAFT and SENT
        // have not reached an outcome, and counting them as failures would
        // understate the rate while they are still live.
        rate: decided > 0 ? this.round1((accepted.count / decided) * 100) : 0,
        accepted: accepted.count,
        decided,
      },
      quotationStatusBreakdown,
      enquiryConversion: {
        won: won.count,
        lost: lost.count,
        open: totalEnquiries - won.count - lost.count,
        total: totalEnquiries,
        winRate:
          won.count + lost.count > 0
            ? this.round1((won.count / (won.count + lost.count)) * 100)
            : 0,
        wonExpectedRevenue: won.expectedRevenue,
      },
      enquiryStageBreakdown,
      unavailableMetrics: this.unavailableMetrics(),
    };
  }

  async getRevenueByPeriod(
    currentUser: CurrentUser,
    query: SalesPeriodQueryDto,
  ): Promise<SafeRevenueByPeriod> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    // Raw SQL because Prisma's groupBy cannot bucket a timestamp by month;
    // parameterized through tagged-template interpolation exactly like
    // QuotationsService.nextQuotationNumber. date_trunc operates on the
    // TIMESTAMP(3) column, which Prisma stores in UTC — so buckets are UTC
    // calendar months.
    const fromClause = query.from
      ? Prisma.sql`AND q."createdAt" >= ${new Date(query.from)}`
      : Prisma.empty;
    const toClause = query.to
      ? Prisma.sql`AND q."createdAt" <= ${new Date(query.to)}`
      : Prisma.empty;
    // Sales Executive revenue rule (Phase 19): scoped to clients CURRENTLY
    // assigned to the caller, never quotation.assignedToId. Additive to the
    // existing organizationId/status filters, never a replacement.
    const ownershipClause = isSalesExec
      ? Prisma.sql`AND c."assignedToId" = ${currentUser.id}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<RevenuePeriodRow[]>`
      SELECT date_trunc('month', q."createdAt") AS "periodStart",
             SUM(q."subtotal" - q."discountAmount") AS "net",
             SUM(q."grandTotal")                    AS "gross",
             COUNT(*)                               AS "quotationCount"
      FROM "quotation" q
      INNER JOIN "client" c ON c."id" = q."clientId"
      WHERE q."organizationId" = ${organizationId}
        AND q."status" = ${QuotationStatus.ACCEPTED}::"QuotationStatus"
        ${fromClause}
        ${toClause}
        ${ownershipClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return {
      period: this.toSafePeriod(query.from, query.to, 'QUOTATION_CREATED_AT'),
      granularity: 'MONTH',
      buckets: rows.map((row) => ({
        periodStart: row.periodStart,
        netAcceptedRevenue: this.round2(this.decimalToNumber(row.net)),
        grossAcceptedValue: this.decimalToNumber(row.gross),
        acceptedQuotationCount: Number(row.quotationCount),
      })),
    };
  }

  async getRevenueByClient(
    currentUser: CurrentUser,
    query: RevenueBreakdownQueryDto,
  ): Promise<SafeRevenueByClient[]> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;

    const groups = await prisma.quotation.groupBy({
      by: ['clientId'],
      where: this.acceptedQuotationWhere(currentUser, query),
      _count: { _all: true },
      _sum: { subtotal: true, discountAmount: true, grandTotal: true },
    });

    const ranked = this.rankAndCap(
      groups.map((group) => ({
        clientId: group.clientId,
        netAcceptedRevenue: this.netOf(group._sum),
        grossAcceptedValue: this.decimalToNumber(group._sum.grandTotal),
        acceptedQuotationCount: group._count._all,
      })),
      query.limit,
    );

    // One query for every name — never one lookup per group. Scoped by
    // organizationId as well as id, so a client outside the caller's
    // organization could not be resolved even if a group id somehow leaked.
    const clients =
      ranked.length > 0
        ? await prisma.client.findMany({
            where: { id: { in: ranked.map((row) => row.clientId) }, organizationId },
            select: { id: true, companyName: true },
          })
        : [];
    const nameById = new Map(clients.map((client) => [client.id, client.companyName]));

    return ranked.map((row) => ({
      ...row,
      companyName: nameById.get(row.clientId) ?? 'Unknown client',
    }));
  }

  async getRevenueByRepresentative(
    currentUser: CurrentUser,
    query: RevenueBreakdownQueryDto,
  ): Promise<SafeRevenueByRepresentative[]> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    // Sales Executive revenue rule (Phase 19), representative-breakdown
    // decision: a Sales Executive must never see another representative's
    // name/id/revenue — even scoping the WHERE by client ownership isn't
    // enough on its own, because a colleague could be quotation.assignedToId
    // on the caller's own client's quotation, and grouping by that column
    // would still surface the colleague's identity. So for a Sales
    // Executive this endpoint does NOT group by quotation.assignedToId at
    // all: it returns exactly one synthetic row representing the caller,
    // aggregating every accepted quotation belonging to their own clients
    // regardless of which rep the quotation itself is assigned to. This
    // remains a real endpoint (never 403) — only its shape narrows to one
    // row. ADMIN/SUPER_ADMIN keep the full multi-representative breakdown,
    // unchanged.
    if (isSalesExec) {
      const where = this.acceptedQuotationWhere(currentUser, query);
      const aggregate = await prisma.quotation.aggregate({
        where,
        _count: { _all: true },
        _sum: { subtotal: true, discountAmount: true, grandTotal: true },
      });
      return [
        {
          userId: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          netAcceptedRevenue: this.netOf(aggregate._sum),
          grossAcceptedValue: this.decimalToNumber(aggregate._sum.grandTotal),
          acceptedQuotationCount: aggregate._count._all,
        },
      ];
    }

    const groups = await prisma.quotation.groupBy({
      by: ['assignedToId'],
      where: this.acceptedQuotationWhere(currentUser, query),
      _count: { _all: true },
      _sum: { subtotal: true, discountAmount: true, grandTotal: true },
    });

    const ranked = this.rankAndCap(
      groups.map((group) => ({
        userId: group.assignedToId,
        netAcceptedRevenue: this.netOf(group._sum),
        grossAcceptedValue: this.decimalToNumber(group._sum.grandTotal),
        acceptedQuotationCount: group._count._all,
      })),
      query.limit,
    );

    const userIds = ranked.map((row) => row.userId).filter((id): id is string => id !== null);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds }, organizationId },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return ranked.map((row) => {
      // A null assignee is reported as its own bucket rather than dropped —
      // otherwise the breakdown would silently fail to sum to the headline.
      if (row.userId === null) {
        return { ...row, name: 'Unassigned', email: null };
      }
      const user = userById.get(row.userId);
      return {
        ...row,
        name: user?.name ?? 'Unknown user',
        email: user?.email ?? null,
      };
    });
  }

  async getRevenueByProduct(
    currentUser: CurrentUser,
    query: RevenueBreakdownQueryDto,
  ): Promise<SafeRevenueByProduct[]> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const limit = query.limit ?? DEFAULT_BREAKDOWN_LIMIT;

    // Raw SQL rather than groupBy because the net-of-tax figure has to be
    // derived per line: only `lineAmount` (which is gross — taxable + tax) is
    // persisted, so the taxable component is recomputed here using the exact
    // formula documented on QuotationLineItem in schema.prisma:
    //
    //   gross    = quantity * unitPriceSnapshot
    //   discount = gross * discountPercentage / 100
    //   taxable  = gross - discount          <- the per-line net
    //
    // Summed over a quotation's lines this equals subtotal - discountAmount,
    // so product revenue reconciles exactly to the headline net revenue.
    //
    // Every input is a persisted historical snapshot (unitPriceSnapshot,
    // quantity, discountPercentage). Product.price is never read here — that
    // is the whole point of the snapshot columns.
    const fromClause = query.from
      ? Prisma.sql`AND q."createdAt" >= ${new Date(query.from)}`
      : Prisma.empty;
    const toClause = query.to
      ? Prisma.sql`AND q."createdAt" <= ${new Date(query.to)}`
      : Prisma.empty;
    // Sales Executive revenue rule (Phase 19): scoped to clients CURRENTLY
    // assigned to the caller, never quotation.assignedToId. Additive to the
    // existing organizationId/status filters, never a replacement.
    const ownershipClause = isSalesExec
      ? Prisma.sql`AND c."assignedToId" = ${currentUser.id}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<RevenueProductRow[]>`
      SELECT li."productId" AS "productId",
             SUM(li."quantity" * li."unitPriceSnapshot"
                 * (1 - li."discountPercentage" / 100)) AS "net",
             SUM(li."lineAmount")                       AS "gross",
             SUM(li."quantity")                         AS "quantity",
             COUNT(*)                                   AS "lineItemCount"
      FROM "quotation_line_item" li
      INNER JOIN "quotation" q ON q."id" = li."quotationId"
      INNER JOIN "client" c ON c."id" = q."clientId"
      WHERE q."organizationId" = ${organizationId}
        AND q."status" = ${QuotationStatus.ACCEPTED}::"QuotationStatus"
        ${fromClause}
        ${toClause}
        ${ownershipClause}
      GROUP BY li."productId"
      ORDER BY 2 DESC
      LIMIT ${limit}
    `;

    const productIds = rows.map((row) => row.productId).filter((id): id is string => id !== null);
    const products =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds }, organizationId },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(products.map((product) => [product.id, product.name]));

    return rows.map((row) => ({
      productId: row.productId,
      // Ad-hoc lines keep a null productId and a single shared label — no
      // product id is fabricated for them.
      productName:
        row.productId === null
          ? AD_HOC_PRODUCT_LABEL
          : (nameById.get(row.productId) ?? 'Unknown product'),
      netAcceptedRevenue: this.round2(this.decimalToNumber(row.net)),
      grossAcceptedValue: this.decimalToNumber(row.gross),
      quantity: this.decimalToNumber(row.quantity),
      lineItemCount: Number(row.lineItemCount),
    }));
  }

  async getLostEnquiries(
    currentUser: CurrentUser,
    query: ListLostEnquiriesQueryDto,
  ): Promise<PaginatedLostEnquiries> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const createdAt = this.createdAtFilter(query.from, query.to);

    const where: Prisma.EnquiryWhereInput = {
      organizationId,
      stage: EnquiryStage.LOST,
      // Sales Executive revenue rule (Phase 19): lost enquiries are scoped
      // to clients CURRENTLY assigned to the caller. Additive to
      // organizationId/stage above, never a replacement of it.
      ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        select: {
          id: true,
          title: true,
          clientId: true,
          client: { select: { companyName: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          lostReason: true,
          expectedRevenue: true,
          createdAt: true,
        },
        // Newest-raised first. Deliberately NOT ordered by updatedAt: that
        // column is bumped by any edit and would imply a "lost at" ordering
        // the database cannot actually support.
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.enquiry.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        clientId: row.clientId,
        clientName: row.client.companyName,
        assignedTo: row.assignedTo,
        lostReason: row.lostReason,
        expectedRevenue: this.decimalToNumber(row.expectedRevenue),
        createdAt: row.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Sales is read-only for every role (approved Phase 7C decision): all
  // three UserRole values may read, and there is no write endpoint on the
  // controller for a manage-tier check to guard. Mirrors
  // FollowUpsService.assertCanRead.
  //
  // Phase 19: for a Sales Executive, every figure is additionally scoped to
  // accepted quotations belonging to clients CURRENTLY assigned to them —
  // never quotation.assignedToId. getRevenueByRepresentative is a further
  // special case: it collapses to a single self-row rather than a
  // per-assignee breakdown, so a colleague's identity/revenue can never
  // surface even indirectly (see that method's own comment).
  //
  // SALES_MANAGER is deliberately not referenced: it is not a value of
  // UserRole. src/constants/roles.ts on the frontend still describes one but
  // is dead configuration and is not an authority here.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view sales data.');
    }
  }

  // ---------------------------------------------------------------------
  // Shared query construction
  // ---------------------------------------------------------------------

  /**
   * The organization-scoped, ACCEPTED-only, period-filtered WHERE clause
   * every revenue breakdown shares. organizationId always originates from the
   * authenticated session — it is never accepted from query or body (the
   * DTOs do not declare it, and the global forbidNonWhitelisted pipe would
   * reject it outright).
   *
   * Sales Executive revenue rule (Phase 19): when the caller is a Sales
   * Executive, additionally scoped to clients CURRENTLY assigned to them —
   * never quotation.assignedToId. Additive to organizationId/status above,
   * never a replacement of it.
   */
  private acceptedQuotationWhere(
    currentUser: CurrentUser,
    query: SalesPeriodQueryDto,
  ): Prisma.QuotationWhereInput {
    const createdAt = this.createdAtFilter(query.from, query.to);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    return {
      organizationId: currentUser.organizationId,
      status: QuotationStatus.ACCEPTED,
      ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }

  /** Inclusive both ends; undefined when neither bound was supplied. */
  private createdAtFilter(
    from: string | undefined,
    to: string | undefined,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  private toSafePeriod(
    from: string | undefined,
    to: string | undefined,
    basis: SalesPeriodBasis,
  ): SafeSalesPeriod {
    return {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
      basis,
    };
  }

  /** Highest net revenue first, then capped to the requested top-N. */
  private rankAndCap<T extends { netAcceptedRevenue: number }>(
    rows: T[],
    limit: number | undefined,
  ): T[] {
    return rows
      .sort((a, b) => b.netAcceptedRevenue - a.netAcceptedRevenue)
      .slice(0, limit ?? DEFAULT_BREAKDOWN_LIMIT);
  }

  private netOf(sums: {
    subtotal: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
  }): number {
    return this.round2(
      this.decimalToNumber(sums.subtotal) - this.decimalToNumber(sums.discountAmount),
    );
  }

  /** Decimal | null | undefined -> number. Never leaks a Decimal to a client. */
  private decimalToNumber(value: Prisma.Decimal | null | undefined): number {
    return value === null || value === undefined ? 0 : Number(value);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round1(value: number): number {
    return Math.round(value * 10) / 10;
  }

  /**
   * Metrics the old mock Sales UI displayed that this database genuinely
   * cannot support. Declared by the API so the frontend renders an honest
   * "unavailable" state with the real reason, rather than a zero (which would
   * read as "none") or an invented figure.
   */
  private unavailableMetrics(): SafeUnavailableMetric[] {
    const noAcceptedAt =
      'No acceptance timestamp is recorded. A quotation status change writes only the status, and updatedAt is bumped by any edit, so acceptance timing cannot be derived.';
    const noWonAt =
      'No won/lost timestamp is recorded on an enquiry. A stage change writes only the stage, so close timing cannot be derived.';
    return [
      { key: 'averageSalesCycle', label: 'Average Sales Cycle', reason: noWonAt },
      { key: 'dealCloseDate', label: 'Deal Close Date', reason: noWonAt },
      { key: 'dealDuration', label: 'Deal Duration', reason: noWonAt },
      {
        key: 'quotationTimeToAcceptance',
        label: 'Quotation Time to Acceptance',
        reason: noAcceptedAt,
      },
      {
        key: 'realizedRevenueTrend',
        label: 'Month-over-Month Realized Revenue',
        reason: `${noAcceptedAt} The revenue trend is bucketed by the date each quotation was raised instead.`,
      },
      {
        key: 'salesTarget',
        label: 'Sales Target / Quota Attainment',
        reason: 'No target or quota field exists in the database.',
      },
      {
        key: 'topPerformer',
        label: 'Top Performer vs Target',
        reason: 'No target or quota field exists to rank representatives against.',
      },
      {
        key: 'representativeRole',
        label: 'Representative Job Title',
        reason:
          'Not stored. A user has a department and one of three CRM roles; no job-title field exists.',
      },
      {
        key: 'lossReasonCategories',
        label: 'Loss Reason Categories',
        reason:
          "An enquiry's lost reason is free text, not a category. Recent lost enquiries are listed with their actual reasons instead.",
      },
    ];
  }
}
