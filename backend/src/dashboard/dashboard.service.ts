import { ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '../auth/auth';
import { EnquiryStage, EnquirySource, FollowUpType, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { LeadSourcesQueryDto } from './dto/lead-sources-query.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';

type CurrentUser = AppSession['user'];

const DEFAULT_ACTIVITY_LIMIT = 10;
/**
 * How many of the most recent rows to pull from *each* source model before
 * merging. Must be >= the largest `limit` a caller can request so the merge
 * never has to go back for more.
 */
const ACTIVITY_FETCH_PER_SOURCE = 50;

/** Stages that have not reached a final outcome — see EnquiriesService for the source of truth on the enum. */
const OPEN_ENQUIRY_STAGES: EnquiryStage[] = [
  EnquiryStage.NEW,
  EnquiryStage.CONTACTED,
  EnquiryStage.FOLLOW_UP,
  EnquiryStage.QUOTATION_SENT,
  EnquiryStage.NEGOTIATION,
];

export interface SafeDashboardSummary {
  /** Count of every Client row in the organization, regardless of status. */
  totalClients: number;
  /** Count of every Product row in the organization, regardless of status. */
  totalProducts: number;
  /** Enquiry.stage NOT IN (WON, LOST) — a snapshot as of now, not period-scoped. */
  openEnquiries: number;
}

export interface SafeLeadSourceBucket {
  source: EnquirySource;
  count: number;
}

export interface SafeDashboardLeadSources {
  period: { from: Date | null; to: Date | null; basis: 'ENQUIRY_CREATED_AT' };
  sources: SafeLeadSourceBucket[];
  totalLeads: number;
}

export type SafeActivityType =
  | 'CLIENT_CREATED'
  | 'ENQUIRY_CREATED'
  | 'QUOTATION_CREATED'
  | 'FOLLOW_UP_COMPLETED';

interface BaseActivity {
  id: string;
  occurredAt: Date;
}

export interface ClientCreatedActivity extends BaseActivity {
  type: 'CLIENT_CREATED';
  clientId: string;
  companyName: string;
}

export interface EnquiryCreatedActivity extends BaseActivity {
  type: 'ENQUIRY_CREATED';
  enquiryId: string;
  title: string;
  clientName: string;
}

export interface QuotationCreatedActivity extends BaseActivity {
  type: 'QUOTATION_CREATED';
  quotationId: string;
  quotationNumber: string;
  clientName: string;
}

export interface FollowUpCompletedActivity extends BaseActivity {
  type: 'FOLLOW_UP_COMPLETED';
  followUpId: string;
  subject: string;
  clientName: string;
}

export type SafeActivity =
  | ClientCreatedActivity
  | EnquiryCreatedActivity
  | QuotationCreatedActivity
  | FollowUpCompletedActivity;

export interface SafeRecentActivity {
  activities: SafeActivity[];
}

export interface SafePeriodCounts {
  from: Date;
  to: Date;
  /** New enquiries raised in this window. */
  leads: number;
  /** Follow-ups of type MEETING created in this window. */
  meetings: number;
  /** Quotations raised in this window. */
  quotes: number;
  /**
   * Enquiries whose stage is currently WON *and* were raised in this window
   * — a raised-date cohort, exactly like every period-scoped Sales figure.
   * Not "enquiries won in this window": the schema records no won-at
   * timestamp (see EnquiriesService.updateStage), so this can only ever be
   * "of what was raised in this window, how much is WON right now".
   */
  wins: number;
}

export interface SafeMonthlyComparison {
  current: SafePeriodCounts;
  previous: SafePeriodCounts;
}

@Injectable()
export class DashboardService {
  // ---------------------------------------------------------------------
  // Dashboard is a read-only aggregation layer over Client / Enquiry /
  // Quotation / Product / FollowUp — it owns no table and writes nothing.
  // Wherever Sales already computes a figure (accepted revenue, enquiry
  // conversion, enquiry stage breakdown, revenue by representative, ...)
  // this module does NOT recompute it: the frontend calls the existing
  // /sales/* endpoints directly for those. This module only adds the
  // handful of aggregations Sales has no reason to own (client/product
  // counts, lead sources, cross-entity recent activity, period-over-period
  // counts of leads/meetings/quotes/wins).
  // ---------------------------------------------------------------------

  async getSummary(currentUser: CurrentUser): Promise<SafeDashboardSummary> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;

    const [totalClients, totalProducts, openEnquiries] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.product.count({ where: { organizationId } }),
      prisma.enquiry.count({ where: { organizationId, stage: { in: OPEN_ENQUIRY_STAGES } } }),
    ]);

    return { totalClients, totalProducts, openEnquiries };
  }

  async getLeadSources(
    currentUser: CurrentUser,
    query: LeadSourcesQueryDto,
  ): Promise<SafeDashboardLeadSources> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const createdAt = this.createdAtFilter(query.from, query.to);

    const groups = await prisma.enquiry.groupBy({
      by: ['source'],
      where: { organizationId, ...(createdAt ? { createdAt } : {}) },
      _count: { _all: true },
    });

    // Zero-filled so every EnquirySource value is always present, exactly
    // like SalesService's quotationStatusBreakdown.
    const sources: SafeLeadSourceBucket[] = Object.values(EnquirySource).map((source) => ({
      source,
      count: groups.find((g) => g.source === source)?._count._all ?? 0,
    }));

    return {
      period: {
        from: query.from ? new Date(query.from) : null,
        to: query.to ? new Date(query.to) : null,
        basis: 'ENQUIRY_CREATED_AT',
      },
      sources,
      totalLeads: sources.reduce((sum, bucket) => sum + bucket.count, 0),
    };
  }

  async getRecentActivity(
    currentUser: CurrentUser,
    query: RecentActivityQueryDto,
  ): Promise<SafeRecentActivity> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;
    const limit = query.limit ?? DEFAULT_ACTIVITY_LIMIT;

    const [clients, enquiries, quotations, completedFollowUps] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId },
        select: { id: true, companyName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_FETCH_PER_SOURCE,
      }),
      prisma.enquiry.findMany({
        where: { organizationId },
        select: { id: true, title: true, createdAt: true, client: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_FETCH_PER_SOURCE,
      }),
      prisma.quotation.findMany({
        where: { organizationId },
        select: {
          id: true,
          quotationNumber: true,
          createdAt: true,
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_FETCH_PER_SOURCE,
      }),
      // completedAt is a genuine, server-set timestamp (written only when a
      // follow-up's status moves to COMPLETED — see FollowUpsService), never
      // fabricated. Rows still pending completion have completedAt = null
      // and are excluded by this filter.
      prisma.followUp.findMany({
        where: { organizationId, completedAt: { not: null } },
        select: {
          id: true,
          subject: true,
          completedAt: true,
          client: { select: { companyName: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: ACTIVITY_FETCH_PER_SOURCE,
      }),
    ]);

    const activities: SafeActivity[] = [
      ...clients.map(
        (c): ClientCreatedActivity => ({
          id: `client-created:${c.id}`,
          type: 'CLIENT_CREATED',
          occurredAt: c.createdAt,
          clientId: c.id,
          companyName: c.companyName,
        }),
      ),
      ...enquiries.map(
        (e): EnquiryCreatedActivity => ({
          id: `enquiry-created:${e.id}`,
          type: 'ENQUIRY_CREATED',
          occurredAt: e.createdAt,
          enquiryId: e.id,
          title: e.title,
          clientName: e.client.companyName,
        }),
      ),
      ...quotations.map(
        (q): QuotationCreatedActivity => ({
          id: `quotation-created:${q.id}`,
          type: 'QUOTATION_CREATED',
          occurredAt: q.createdAt,
          quotationId: q.id,
          quotationNumber: q.quotationNumber,
          clientName: q.client.companyName,
        }),
      ),
      // completedAt is filtered non-null above, so this cast is safe.
      ...completedFollowUps.map(
        (f): FollowUpCompletedActivity => ({
          id: `follow-up-completed:${f.id}`,
          type: 'FOLLOW_UP_COMPLETED',
          occurredAt: f.completedAt as Date,
          followUpId: f.id,
          subject: f.subject,
          clientName: f.client.companyName,
        }),
      ),
    ];

    activities.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { activities: activities.slice(0, limit) };
  }

  async getMonthlyComparison(currentUser: CurrentUser): Promise<SafeMonthlyComparison> {
    this.assertCanRead(currentUser);
    const { organizationId } = currentUser;

    // UTC calendar months, matching SalesService.getRevenueByPeriod's
    // date_trunc('month', ...) bucketing.
    const now = new Date();
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const currentEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, -1),
    );
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, -1));

    const [current, previous] = await Promise.all([
      this.periodCounts(organizationId, currentStart, currentEnd),
      this.periodCounts(organizationId, previousStart, previousEnd),
    ]);

    return { current, previous };
  }

  private async periodCounts(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<SafePeriodCounts> {
    const createdAt = { gte: from, lte: to };
    const [leads, meetings, quotes, wins] = await Promise.all([
      prisma.enquiry.count({ where: { organizationId, createdAt } }),
      prisma.followUp.count({ where: { organizationId, type: FollowUpType.MEETING, createdAt } }),
      prisma.quotation.count({ where: { organizationId, createdAt } }),
      prisma.enquiry.count({ where: { organizationId, stage: EnquiryStage.WON, createdAt } }),
    ]);
    return { from, to, leads, meetings, quotes, wins };
  }

  // ---------------------------------------------------------------------
  // Authorization — same three readable roles as every completed module
  // (Clients/Enquiries/Products/Quotations/Follow-ups/Sales). Dashboard has
  // no write routes for a manage-tier check to guard.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view the dashboard.');
    }
  }

  private createdAtFilter(
    from: string | undefined,
    to: string | undefined,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
}
