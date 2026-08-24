import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { ProductStatus, QuotationStatus, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateQuotationDto, CreateQuotationLineItemDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto, UpdateQuotationLineItemDto } from './dto/update-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';
import { ListQuotationsQueryDto } from './dto/list-quotations-query.dto';

type CurrentUser = AppSession['user'];
type TxClient = Prisma.TransactionClient;

const QUOTATION_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  enquiry: { select: { id: true, title: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  // Ordered by creation order (not alphabetically, unlike
  // EnquiriesService's product list) — a quotation is a document, and its
  // lines must render in the order the user entered them. `id` is a
  // secondary tiebreaker: every line on a single create/update transaction
  // shares the exact same `createdAt` (Postgres's now() is transaction-time,
  // not statement-time), and Prisma's cuid()s are generated in array order,
  // so the tiebreaker keeps display order stable across refetches.
  lineItems: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.QuotationInclude;

type QuotationWithRelations = Prisma.QuotationGetPayload<{ include: typeof QUOTATION_INCLUDE }>;
type QuotationLineItemRow = QuotationWithRelations['lineItems'][number];

export interface SafeQuotationLineItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  description: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  discountPercentage: number;
  taxRate: number;
  lineAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeQuotation {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  enquiryId: string | null;
  enquiryTitle: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  quotationNumber: string;
  status: QuotationStatus;
  validUntil: Date;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  lineItems: SafeQuotationLineItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedQuotations {
  data: SafeQuotation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// A line item after validation/snapshot-resolution, ready to persist. All
// monetary/quantity fields are Prisma.Decimal so every downstream
// calculation stays Decimal-safe (never plain JS floating point).
interface ResolvedLineItem {
  productId: string | null;
  productNameSnapshot: string;
  description: string | null;
  quantity: Prisma.Decimal;
  unitPriceSnapshot: Prisma.Decimal;
  discountPercentage: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  gross: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  lineAmount: Prisma.Decimal;
}

interface QuotationTotals {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  async create(dto: CreateQuotationDto, currentUser: CurrentUser): Promise<SafeQuotation> {
    this.assertCanManage(currentUser);

    await this.assertClientInOrg(dto.clientId, currentUser.organizationId);
    if (dto.enquiryId) {
      await this.assertEnquiryUsable(dto.enquiryId, dto.clientId, currentUser.organizationId);
    }
    if (dto.assignedToId) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }

    const resolvedLines = await this.resolveLineItems(dto.lineItems, currentUser.organizationId);
    const totals = this.calculateTotals(resolvedLines);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const quotationNumber = await this.nextQuotationNumber(currentUser.organizationId, tx);
        return tx.quotation.create({
          data: {
            organizationId: currentUser.organizationId,
            clientId: dto.clientId,
            enquiryId: dto.enquiryId ?? null,
            assignedToId: dto.assignedToId ?? null,
            quotationNumber,
            status: QuotationStatus.DRAFT,
            validUntil: new Date(dto.validUntil),
            notes: dto.notes,
            terms: dto.terms,
            subtotal: totals.subtotal,
            discountAmount: totals.discountAmount,
            taxAmount: totals.taxAmount,
            grandTotal: totals.grandTotal,
            lineItems: { create: resolvedLines.map((line) => this.toLineItemCreateInput(line)) },
          },
          include: QUOTATION_INCLUDE,
        });
      });
      return this.toSafeQuotation(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListQuotationsQueryDto,
  ): Promise<PaginatedQuotations> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.QuotationWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.enquiryId ? { enquiryId: query.enquiryId } : {}),
      ...(query.search
        ? {
            OR: [
              { quotationNumber: { contains: query.search, mode: 'insensitive' } },
              { client: { companyName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: QUOTATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quotation.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeQuotation(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeQuotation> {
    this.assertCanRead(currentUser);
    const quotation = await this.getOrgQuotationOrThrow(id, currentUser.organizationId);
    return this.toSafeQuotation(quotation);
  }

  // Editing is allowed regardless of the quotation's current status — there
  // is no existing precedent anywhere in this codebase for a status-gated
  // edit restriction (Enquiry.stage and Client.status both allow ordinary
  // field edits in any state), so none is invented here. See
  // UpdateQuotationDto's doc comment and the Phase 6B final report for the
  // full rationale.
  async update(id: string, dto: UpdateQuotationDto, currentUser: CurrentUser): Promise<SafeQuotation> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgQuotationOrThrow(id, currentUser.organizationId);

    const effectiveClientId = existing.clientId;

    if (dto.enquiryId !== undefined && dto.enquiryId !== null) {
      await this.assertEnquiryUsable(dto.enquiryId, effectiveClientId, currentUser.organizationId);
    }
    if (dto.assignedToId !== undefined && dto.assignedToId !== null) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }

    // Resolved (and fully validated) before any write so a rejected line
    // item set leaves the quotation's own fields untouched as well —
    // mirrors EnquiriesService.update's productChanges-before-transaction
    // pattern. Uses resolveLineItemsForUpdate (not resolveLineItems) so a
    // line matched by id with an unchanged productId keeps its existing
    // snapshot instead of being silently refreshed from the current Product.
    const resolvedLines =
      dto.lineItems === undefined
        ? null
        : await this.resolveLineItemsForUpdate(dto.lineItems, currentUser.organizationId, existing.lineItems);
    const totals = resolvedLines ? this.calculateTotals(resolvedLines) : null;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.quotation.update({
          where: { id: existing.id },
          data: {
            ...(dto.enquiryId !== undefined ? { enquiryId: dto.enquiryId } : {}),
            ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
            ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
            ...(totals
              ? {
                  subtotal: totals.subtotal,
                  discountAmount: totals.discountAmount,
                  taxAmount: totals.taxAmount,
                  grandTotal: totals.grandTotal,
                }
              : {}),
          },
        });

        if (resolvedLines) {
          // Whole-set replace: simplest deterministic behaviour for a
          // document-shaped list of lines (see UpdateQuotationDto). Lines
          // not included in this request are never touched, so their
          // historical snapshots are only ever replaced when the caller
          // explicitly resends the `lineItems` key.
          await tx.quotationLineItem.deleteMany({ where: { quotationId: existing.id } });
          await tx.quotationLineItem.createMany({
            data: resolvedLines.map((line) => ({
              quotationId: existing.id,
              ...this.toLineItemCreateInput(line),
            })),
          });
        }

        // Re-read org-scoped rather than by id alone — same rule as every
        // other tenant-sensitive read in this service.
        return tx.quotation.findFirstOrThrow({
          where: { id: existing.id, organizationId: currentUser.organizationId },
          include: QUOTATION_INCLUDE,
        });
      });
      return this.toSafeQuotation(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateQuotationStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeQuotation> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgQuotationOrThrow(id, currentUser.organizationId);

    // No transition graph: any status may move to any other status. This
    // mirrors the only existing precedent for a multi-value workflow
    // status in this codebase — EnquiriesService.updateStage — which
    // itself performs zero transition validation. Inventing a stricter
    // graph here would be a new, undocumented business rule. See the
    // Phase 6B final report for the full rationale.
    const updated = await prisma.quotation.update({
      where: { id: existing.id },
      data: { status: dto.status },
      include: QUOTATION_INCLUDE,
    });
    return this.toSafeQuotation(updated);
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Follows the approved Phase 6B instruction to mirror ProductsService's
  // authorization pattern exactly: all three roles get organization-wide
  // read, but only SUPER_ADMIN/ADMIN may create/update/change status.
  //
  // This is a deliberate divergence from src/constants/roles.ts on the
  // frontend, which currently marks `quotations` as VIEW_CREATE_EDIT for
  // sales-executive (the same tier Clients/Enquiries use). That frontend
  // permission table is not enforced by this backend and is out of scope
  // for Phase 6B to change — see the Phase 6B final report.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view quotations.');
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can manage quotations.');
    }
  }

  // ---------------------------------------------------------------------
  // Cross-entity tenant validation
  // ---------------------------------------------------------------------

  private async assertClientInOrg(clientId: string, organizationId: string): Promise<void> {
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) {
      throw new BadRequestException('clientId must reference a client in your organization.');
    }
  }

  // Validates that enquiryId belongs to the caller's organization AND to
  // the same client as the quotation — a direct consequence of the
  // approved Client -> Enquiry -> Quotation architecture: an enquiry linked
  // to a quotation for a different client would be a data-integrity defect
  // the schema itself cannot prevent (Postgres cannot express
  // "quotation.clientId = enquiry.clientId" through a foreign key).
  private async assertEnquiryUsable(
    enquiryId: string,
    clientId: string,
    organizationId: string,
  ): Promise<void> {
    const enquiry = await prisma.enquiry.findFirst({ where: { id: enquiryId, organizationId } });
    if (!enquiry) {
      throw new BadRequestException('enquiryId must reference an enquiry in your organization.');
    }
    if (enquiry.clientId !== clientId) {
      throw new BadRequestException('enquiryId must belong to the same client as this quotation.');
    }
  }

  private async assertAssignedUserInOrg(assignedToId: string, organizationId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId } });
    if (!user) {
      throw new BadRequestException('assignedToId must reference a user in your organization.');
    }
  }

  // ---------------------------------------------------------------------
  // Line item resolution, snapshotting, and calculation
  // ---------------------------------------------------------------------

  /**
   * Validates and resolves every line in a create/update request into its
   * persist-ready Decimal form, snapshotting catalog products as it goes.
   *
   * CATALOG lines (productId set): the product must exist, belong to the
   * caller's organization, and — since this is always a *new* attachment
   * (see UpdateQuotationDto's whole-set-replace doc comment) — be ACTIVE.
   * productNameSnapshot/unitPriceSnapshot are taken from the live Product
   * right now and never from client input, so a client can never forge a
   * snapshot for a real catalog product.
   *
   * AD-HOC lines (productId omitted): productName/unitPrice are supplied by
   * the client directly (already required by CreateQuotationLineItemDto's
   * ValidateIf) and become the snapshot as-is — there is no authoritative
   * backend source for a non-catalog line.
   */
  private async resolveLineItems(
    lines: CreateQuotationLineItemDto[],
    organizationId: string,
  ): Promise<ResolvedLineItem[]> {
    const productIds = [...new Set(lines.map((line) => line.productId).filter((id): id is string => !!id))];

    const products =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds }, organizationId },
            select: { id: true, name: true, price: true, status: true },
          })
        : [];
    const productsById = new Map(products.map((product) => [product.id, product]));

    const unknown = productIds.filter((id) => !productsById.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `productId must reference a product in your organization. Unknown: ${unknown.join(', ')}`,
      );
    }
    const inactive = productIds.filter((id) => productsById.get(id)?.status === ProductStatus.INACTIVE);
    if (inactive.length > 0) {
      const names = inactive.map((id) => productsById.get(id)?.name ?? id);
      throw new BadRequestException(
        `Inactive products cannot be added to a new quotation line: ${names.join(', ')}`,
      );
    }

    return lines.map((line) => {
      const quantity = new Prisma.Decimal(line.quantity).toDecimalPlaces(2);
      const discountPercentage = new Prisma.Decimal(line.discountPercentage ?? 0).toDecimalPlaces(2);
      const taxRate = new Prisma.Decimal(line.taxRate ?? 0).toDecimalPlaces(2);

      let productId: string | null = null;
      let productNameSnapshot: string;
      let unitPriceSnapshot: Prisma.Decimal;

      if (line.productId) {
        const product = productsById.get(line.productId)!;
        productId = product.id;
        productNameSnapshot = product.name;
        unitPriceSnapshot = new Prisma.Decimal(product.price).toDecimalPlaces(2);
      } else {
        // DTO validation guarantees productName/unitPrice are present
        // whenever productId is absent.
        productNameSnapshot = line.productName!;
        unitPriceSnapshot = new Prisma.Decimal(line.unitPrice!).toDecimalPlaces(2);
      }

      return {
        productId,
        productNameSnapshot,
        description: line.description ?? null,
        quantity,
        unitPriceSnapshot,
        discountPercentage,
        taxRate,
        ...this.computeLineAmounts(unitPriceSnapshot, quantity, discountPercentage, taxRate),
      };
    });
  }

  /**
   * Resolves an update request's line items with historical-snapshot
   * preservation (Phase 6C requirement): a line whose `id` matches an
   * existing line on this quotation AND whose `productId` is unchanged from
   * what that line already has keeps its existing productNameSnapshot/
   * unitPriceSnapshot untouched — only quantity/discountPercentage/taxRate
   * (and therefore lineAmount) are recomputed from the request. Every other
   * line (no matching id, or a changed productId — i.e. the user explicitly
   * picked a different product) is resolved exactly like a create: fresh
   * validation, fresh snapshot from the live Product (or the supplied
   * ad-hoc name/price). This is what stops re-saving a quotation from
   * silently refreshing an untouched line's historical price/name to the
   * catalog's current values, while still letting an explicit product swap
   * take a new snapshot immediately.
   *
   * Preserved lines deliberately skip the ACTIVE-product check that
   * resolveLineItems applies to fresh lines: an already-attached product
   * that has since gone INACTIVE must stay attached and stay editable
   * (quantity/discount/tax), the same precedent EnquiriesService.
   * resolveProductChanges establishes for already-attached products.
   */
  private async resolveLineItemsForUpdate(
    lines: UpdateQuotationLineItemDto[],
    organizationId: string,
    existingLines: QuotationLineItemRow[],
  ): Promise<ResolvedLineItem[]> {
    const existingById = new Map(existingLines.map((existingLine) => [existingLine.id, existingLine]));

    const toPreserve: { line: UpdateQuotationLineItemDto; existing: QuotationLineItemRow }[] = [];
    const toResolveFresh: UpdateQuotationLineItemDto[] = [];

    for (const line of lines) {
      const matched = line.id ? existingById.get(line.id) : undefined;
      if (matched && matched.productId === (line.productId ?? null)) {
        toPreserve.push({ line, existing: matched });
      } else {
        toResolveFresh.push(line);
      }
    }

    const freshlyResolved =
      toResolveFresh.length > 0 ? await this.resolveLineItems(toResolveFresh, organizationId) : [];

    const preserved: ResolvedLineItem[] = toPreserve.map(({ line, existing }) => {
      const quantity = new Prisma.Decimal(line.quantity).toDecimalPlaces(2);
      const discountPercentage = new Prisma.Decimal(line.discountPercentage ?? 0).toDecimalPlaces(2);
      const taxRate = new Prisma.Decimal(line.taxRate ?? 0).toDecimalPlaces(2);
      const unitPriceSnapshot = new Prisma.Decimal(existing.unitPriceSnapshot).toDecimalPlaces(2);

      return {
        productId: existing.productId,
        productNameSnapshot: existing.productNameSnapshot,
        description: line.description ?? existing.description ?? null,
        quantity,
        unitPriceSnapshot,
        discountPercentage,
        taxRate,
        ...this.computeLineAmounts(unitPriceSnapshot, quantity, discountPercentage, taxRate),
      };
    });

    return [...freshlyResolved, ...preserved];
  }

  private computeLineAmounts(
    unitPriceSnapshot: Prisma.Decimal,
    quantity: Prisma.Decimal,
    discountPercentage: Prisma.Decimal,
    taxRate: Prisma.Decimal,
  ): { gross: Prisma.Decimal; discount: Prisma.Decimal; tax: Prisma.Decimal; lineAmount: Prisma.Decimal } {
    const gross = unitPriceSnapshot.mul(quantity).toDecimalPlaces(2);
    const discount = gross.mul(discountPercentage).div(100).toDecimalPlaces(2);
    const taxable = gross.sub(discount);
    const tax = taxable.mul(taxRate).div(100).toDecimalPlaces(2);
    const lineAmount = taxable.add(tax).toDecimalPlaces(2);
    return { gross, discount, tax, lineAmount };
  }

  private calculateTotals(lines: ResolvedLineItem[]): QuotationTotals {
    const zero = new Prisma.Decimal(0);
    const subtotal = lines.reduce((sum, line) => sum.add(line.gross), zero);
    const discountAmount = lines.reduce((sum, line) => sum.add(line.discount), zero);
    const taxAmount = lines.reduce((sum, line) => sum.add(line.tax), zero);
    const grandTotal = subtotal.sub(discountAmount).add(taxAmount);
    return { subtotal, discountAmount, taxAmount, grandTotal };
  }

  // Flat scalar `productId` (not a relational `product: { connect }`
  // object) so this same shape works both for the nested `create` used by
  // create() and for the plain `createMany` used by update() — createMany
  // does not accept Prisma's nested relation-connect syntax at all.
  private toLineItemCreateInput(
    line: ResolvedLineItem,
  ): Omit<Prisma.QuotationLineItemCreateManyInput, 'quotationId'> {
    return {
      productId: line.productId,
      productNameSnapshot: line.productNameSnapshot,
      description: line.description,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPriceSnapshot,
      discountPercentage: line.discountPercentage,
      taxRate: line.taxRate,
      lineAmount: line.lineAmount,
    };
  }

  // ---------------------------------------------------------------------
  // Quotation numbering
  //
  // Narrowly scoped to this one purpose (see QuotationNumberCounter's
  // schema doc comment). A single atomic `INSERT ... ON CONFLICT DO
  // UPDATE ... RETURNING` is race-safe under concurrent creates for the
  // same (organizationId, year) without relying on Prisma's upsert
  // semantics or an application-level lock, and runs inside the same
  // transaction as the Quotation write so a failed create rolls the
  // counter increment back too.
  // ---------------------------------------------------------------------

  private async nextQuotationNumber(organizationId: string, tx: TxClient): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO "quotation_number_counter" ("organizationId", "year", "lastNumber")
      VALUES (${organizationId}, ${year}, 1)
      ON CONFLICT ("organizationId", "year")
      DO UPDATE SET "lastNumber" = "quotation_number_counter"."lastNumber" + 1
      RETURNING "lastNumber"
    `;
    const sequence = rows[0].lastNumber;
    return `QT-${year}-${String(sequence).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------
  // Reads and mapping
  // ---------------------------------------------------------------------

  private async getOrgQuotationOrThrow(
    id: string,
    organizationId: string,
  ): Promise<QuotationWithRelations> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so a quotation belonging to another org behaves as NOT FOUND, not
    // 403, and never leaks whether the id exists elsewhere.
    const quotation = await prisma.quotation.findFirst({
      where: { id, organizationId },
      include: QUOTATION_INCLUDE,
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found.');
    }
    return quotation;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: a foreign key (clientId / enquiryId / assignedToId /
      // productId) pointed at a row that no longer exists. All are
      // pre-validated above, so this is only reachable on a concurrent
      // delete — reported as a 400 rather than surfacing the Prisma
      // constraint name (mirrors EnquiriesService/ProductsService).
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Referenced client, enquiry, assigned user or product no longer exists.',
        );
      }
      // P2002: the organizationId+quotationNumber unique constraint fired.
      // The numbering generator is atomic and transactional, so this
      // should never happen in practice; treated as unexpected rather than
      // a normal validation failure.
      if (error.code === 'P2002') {
        this.logger.error('Unexpected duplicate quotation number', error);
        throw new InternalServerErrorException('Failed to generate a unique quotation number.');
      }
      // P2025: the quotation disappeared between the org-scoped read and
      // the write. Reported as 404 to stay consistent with the read path.
      if (error.code === 'P2025') {
        throw new NotFoundException('Quotation not found.');
      }
    }
    this.logger.error('Unexpected error writing quotation', error as Error);
    throw new InternalServerErrorException('Failed to save quotation.');
  }

  private toSafeQuotation(quotation: QuotationWithRelations): SafeQuotation {
    return {
      id: quotation.id,
      organizationId: quotation.organizationId,
      clientId: quotation.clientId,
      clientName: quotation.client.companyName,
      enquiryId: quotation.enquiryId,
      enquiryTitle: quotation.enquiry?.title ?? null,
      assignedTo: quotation.assignedTo,
      quotationNumber: quotation.quotationNumber,
      status: quotation.status,
      validUntil: quotation.validUntil,
      notes: quotation.notes,
      terms: quotation.terms,
      subtotal: Number(quotation.subtotal),
      discountAmount: Number(quotation.discountAmount),
      taxAmount: Number(quotation.taxAmount),
      grandTotal: Number(quotation.grandTotal),
      lineItems: quotation.lineItems.map((line) => this.toSafeLineItem(line)),
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    };
  }

  private toSafeLineItem(line: QuotationLineItemRow): SafeQuotationLineItem {
    return {
      id: line.id,
      productId: line.productId,
      productNameSnapshot: line.productNameSnapshot,
      description: line.description,
      quantity: Number(line.quantity),
      unitPriceSnapshot: Number(line.unitPriceSnapshot),
      discountPercentage: Number(line.discountPercentage),
      taxRate: Number(line.taxRate),
      lineAmount: Number(line.lineAmount),
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    };
  }
}
