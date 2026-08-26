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
import {
  EnquirySource,
  EnquiryStage,
  Priority,
  ProductStatus,
  UserRole,
} from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { UpdateEnquiryStageDto } from './dto/update-enquiry-stage.dto';
import { ListEnquiriesQueryDto } from './dto/list-enquiries-query.dto';

type CurrentUser = AppSession['user'];

const ENQUIRY_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  // Attached products are resolved through the join model on every read
  // (list and detail alike) so the enquiry never carries a denormalized
  // product name. Ordered by product name for a stable display order that
  // does not depend on the order they happened to be attached in.
  enquiryProducts: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          sku: true,
          unit: true,
          status: true,
          productGroup: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { product: { name: 'asc' } },
  },
} satisfies Prisma.EnquiryInclude;

type EnquiryWithRelations = Prisma.EnquiryGetPayload<{ include: typeof ENQUIRY_INCLUDE }>;

/**
 * One product attached to an enquiry. `id` is the join row's id (so the
 * frontend can address the relationship itself); `productId` is the stable
 * Product id that is the actual source of truth. Everything else is resolved
 * live from the Product relation — nothing is copied onto the join row, so a
 * renamed or repriced product shows its current values here.
 *
 * `status` is included deliberately: an INACTIVE product that was attached
 * while it was still active stays attached and stays visible, and the UI
 * needs this field to mark it as such.
 */
export interface SafeEnquiryProduct {
  id: string;
  productId: string;
  name: string;
  productGroup: { id: string; name: string };
  price: number;
  sku: string | null;
  unit: string | null;
  status: ProductStatus;
}

export interface SafeEnquiry {
  id: string;
  organizationId: string;
  title: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  stage: EnquiryStage;
  expectedRevenue: number;
  probability: number;
  priority: Priority;
  source: EnquirySource;
  assignedTo: { id: string; name: string; email: string } | null;
  description: string | null;
  notes: string | null;
  expectedCloseDate: Date;
  lostReason: string | null;
  tags: string[];
  products: SafeEnquiryProduct[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedEnquiries {
  data: SafeEnquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  async create(dto: CreateEnquiryDto, currentUser: CurrentUser): Promise<SafeEnquiry> {
    this.assertCanCreate(currentUser);

    await this.assertClientInOrg(dto.clientId, currentUser);
    if (dto.assignedToId) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }

    const stage = dto.stage ?? EnquiryStage.NEW;
    // DTO validation (ValidateIf) already guarantees lostReason is a
    // non-empty string whenever stage is LOST; the trim check additionally
    // rejects a whitespace-only value.
    if (stage === EnquiryStage.LOST) {
      this.assertLostReasonPresent(dto.lostReason);
    }

    // Every supplied product id is fully validated (exists, same
    // organization, ACTIVE, no duplicates) before the enquiry row is
    // written, so an invalid product never leaves a half-created enquiry
    // behind. On create every id is a *new* attachment, so none of them may
    // be INACTIVE.
    const productIds = dto.productIds ?? [];
    this.assertNoDuplicateProductIds(productIds);
    await this.assertProductsAttachable(productIds, currentUser.organizationId);

    try {
      const created = await prisma.enquiry.create({
        data: {
          organizationId: currentUser.organizationId,
          clientId: dto.clientId,
          assignedToId: dto.assignedToId ?? null,
          title: dto.title,
          stage,
          expectedRevenue: new Prisma.Decimal(dto.expectedRevenue),
          probability: dto.probability,
          priority: dto.priority,
          source: dto.source,
          description: dto.description,
          notes: dto.notes,
          expectedCloseDate: new Date(dto.expectedCloseDate),
          // Only persisted when the enquiry actually starts LOST — never
          // fabricated for a non-LOST stage.
          lostReason: stage === EnquiryStage.LOST ? dto.lostReason : null,
          tags: dto.tags ?? [],
          enquiryProducts: {
            create: productIds.map((productId) => ({ productId })),
          },
        },
        include: ENQUIRY_INCLUDE,
      });
      return this.toSafeEnquiry(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListEnquiriesQueryDto,
  ): Promise<PaginatedEnquiries> {
    this.assertCanRead(currentUser);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.EnquiryWhereInput = {
      organizationId: currentUser.organizationId,
      // Sales Executive ownership rule (Phase 19): client ownership is
      // authoritative — Enquiry.assignedToId is deliberately NOT used as
      // the visibility boundary. Additive to organizationId above, never a
      // replacement of it.
      ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.search
        ? {
            // Covers what the Enquiries UI surfaces on a card/row: the
            // enquiry title and the owning client's company name.
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { client: { companyName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: ENQUIRY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.enquiry.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeEnquiry(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeEnquiry> {
    this.assertCanRead(currentUser);
    const enquiry = await this.getOrgEnquiryOrThrow(id, currentUser);
    return this.toSafeEnquiry(enquiry);
  }

  async update(id: string, dto: UpdateEnquiryDto, currentUser: CurrentUser): Promise<SafeEnquiry> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgEnquiryOrThrow(id, currentUser);

    if (dto.assignedToId !== undefined && dto.assignedToId !== null) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }

    // Resolved (and fully validated) before any write so a rejected product
    // set leaves the enquiry's own fields untouched as well.
    const productChanges =
      dto.productIds === undefined
        ? null
        : await this.resolveProductChanges(existing, dto.productIds, currentUser.organizationId);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.enquiry.update({
          where: { id: existing.id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.expectedRevenue !== undefined
              ? { expectedRevenue: new Prisma.Decimal(dto.expectedRevenue) }
              : {}),
            ...(dto.probability !== undefined ? { probability: dto.probability } : {}),
            ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
            ...(dto.source !== undefined ? { source: dto.source } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.expectedCloseDate !== undefined
              ? { expectedCloseDate: new Date(dto.expectedCloseDate) }
              : {}),
            ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
            ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
          },
        });

        if (productChanges) {
          // Detach first, then attach: keeps the work minimal and never
          // touches the rows that are staying, which is what preserves an
          // already-attached INACTIVE product across a save.
          if (productChanges.toDetach.length > 0) {
            await tx.enquiryProduct.deleteMany({
              where: { enquiryId: existing.id, productId: { in: productChanges.toDetach } },
            });
          }
          if (productChanges.toAttach.length > 0) {
            await tx.enquiryProduct.createMany({
              data: productChanges.toAttach.map((productId) => ({
                enquiryId: existing.id,
                productId,
              })),
            });
          }
        }

        // Re-read org-scoped rather than by id alone — same rule as every
        // other tenant-sensitive read in this service.
        return tx.enquiry.findFirstOrThrow({
          where: { id: existing.id, organizationId: currentUser.organizationId },
          include: ENQUIRY_INCLUDE,
        });
      });
      return this.toSafeEnquiry(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStage(
    id: string,
    dto: UpdateEnquiryStageDto,
    currentUser: CurrentUser,
  ): Promise<SafeEnquiry> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgEnquiryOrThrow(id, currentUser);

    const data: Prisma.EnquiryUpdateInput = { stage: dto.stage };
    if (dto.stage === EnquiryStage.LOST) {
      this.assertLostReasonPresent(dto.lostReason);
      data.lostReason = dto.lostReason;
    }
    // Moving away from LOST intentionally leaves lostReason untouched: it's
    // preserved as history of the prior loss, not cleared and never
    // fabricated. Mirrors ClientsService.updateStatus's churnReason rule.

    try {
      const updated = await prisma.enquiry.update({
        where: { id: existing.id },
        data,
        include: ENQUIRY_INCLUDE,
      });
      return this.toSafeEnquiry(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // All three roles get read/create/update on enquiries, but (Phase 19) a
  // Sales Executive is additionally scoped to enquiries whose CLIENT is
  // assigned to them: findAllForOrg/getOrgEnquiryOrThrow filter via the
  // client relation, and create() validates dto.clientId the same way.
  // Enquiry.assignedToId is deliberately NOT the visibility boundary and
  // remains freely settable to any org user, exactly as before — client
  // ownership alone governs what a Sales Executive can see.
  //
  // Unlike Clients there is no narrower admin-only tier: Clients restricts
  // status changes and contact management to SUPER_ADMIN/ADMIN because
  // deactivating a client is that module's stand-in for delete. A stage
  // change is ordinary pipeline work every Sales Executive performs (it is
  // the primary interaction of the kanban board), and there is no
  // `enquiries.delete = false` entry in src/constants/roles.ts to mirror,
  // so stage transitions follow the same rule as update.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to view enquiries.');
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to create enquiries.');
    }
  }

  private assertCanUpdate(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException('You do not have permission to update enquiries.');
    }
  }

  private assertLostReasonPresent(lostReason: string | undefined): void {
    if (!lostReason || lostReason.trim().length === 0) {
      throw new BadRequestException('lostReason is required when an enquiry is marked LOST.');
    }
  }

  private async assertClientInOrg(clientId: string, currentUser: CurrentUser): Promise<void> {
    // Scoped by organizationId so a client in another org is indistinguishable
    // from one that does not exist — same non-leaking behaviour as the
    // enquiry lookup itself. Sales Executive ownership rule (Phase 19): also
    // scoped to the caller's own clients — this is creation-time business
    // validation on a caller-supplied clientId (a 400), not a single-record
    // id-probing scenario (which stays a 404 in getOrgEnquiryOrThrow).
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { assignedToId: currentUser.id } : {}),
      },
    });
    if (!client) {
      throw new BadRequestException(
        isSalesExec
          ? 'clientId must reference a client assigned to you.'
          : 'clientId must reference a client in your organization.',
      );
    }
  }

  // ---------------------------------------------------------------------
  // Product attachment
  // ---------------------------------------------------------------------

  /**
   * A repeated product id is a malformed request, not an instruction to
   * attach twice — rejected explicitly rather than silently de-duplicated,
   * so the caller learns their payload was wrong. (The composite unique on
   * EnquiryProduct is the database-level backstop; this is the clean error.)
   */
  private assertNoDuplicateProductIds(productIds: string[]): void {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of productIds) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    if (duplicates.size > 0) {
      throw new BadRequestException(
        `productIds must not contain duplicates: ${[...duplicates].join(', ')}`,
      );
    }
  }

  /**
   * Validates ids that are about to become NEW attachments. Scoped by
   * organizationId (never a bare findUnique/findMany by id), so a product in
   * another organization is indistinguishable from one that does not exist —
   * both are rejected as unknown, and neither can be smuggled in through a
   * hand-crafted request body.
   *
   * INACTIVE products are rejected here because this only ever runs for new
   * attachments. Products already attached to the enquiry never reach this
   * method (see resolveProductChanges), which is exactly what lets an
   * already-attached product that has since been deactivated stay attached.
   */
  private async assertProductsAttachable(
    productIds: string[],
    organizationId: string,
  ): Promise<void> {
    if (productIds.length === 0) return;

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: { id: true, name: true, status: true },
    });

    const byId = new Map(products.map((product) => [product.id, product]));

    const unknown = productIds.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `productIds must reference products in your organization. Unknown: ${unknown.join(', ')}`,
      );
    }

    const inactive = productIds.filter((id) => byId.get(id)?.status === ProductStatus.INACTIVE);
    if (inactive.length > 0) {
      const names = inactive.map((id) => byId.get(id)?.name ?? id);
      throw new BadRequestException(
        `Inactive products cannot be added to an enquiry: ${names.join(', ')}`,
      );
    }
  }

  /**
   * Turns a requested product set into the minimal attach/detach work needed
   * to reach it, validating only the additions.
   *
   * Ids already attached are deliberately left out of validation: an enquiry
   * that still lists a product which has since gone INACTIVE saves cleanly
   * and keeps it, while the same enquiry can still remove it on purpose
   * simply by leaving it out of the requested set.
   */
  private async resolveProductChanges(
    existing: EnquiryWithRelations,
    requestedProductIds: string[],
    organizationId: string,
  ): Promise<{ toAttach: string[]; toDetach: string[] }> {
    this.assertNoDuplicateProductIds(requestedProductIds);

    const attached = new Set(existing.enquiryProducts.map((link) => link.productId));
    const requested = new Set(requestedProductIds);

    const toAttach = requestedProductIds.filter((id) => !attached.has(id));
    const toDetach = [...attached].filter((id) => !requested.has(id));

    await this.assertProductsAttachable(toAttach, organizationId);

    return { toAttach, toDetach };
  }

  private async assertAssignedUserInOrg(assignedToId: string, organizationId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId } });
    if (!user) {
      throw new BadRequestException('assignedToId must reference a user in your organization.');
    }
  }

  private async getOrgEnquiryOrThrow(
    id: string,
    currentUser: CurrentUser,
  ): Promise<EnquiryWithRelations> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so an enquiry belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere. Sales Executive
    // ownership rule (Phase 19): the same additive condition, via the
    // client relation — client ownership is authoritative, never
    // Enquiry.assignedToId — so another rep's client's enquiry (or one on
    // an unassigned client) is likewise NOT FOUND, never a 403.
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const enquiry = await prisma.enquiry.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      },
      include: ENQUIRY_INCLUDE,
    });
    if (!enquiry) {
      throw new NotFoundException('Enquiry not found.');
    }
    return enquiry;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: a foreign key (clientId / assignedToId) pointed at a row that
      // does not exist. Both are pre-validated above, so this is only
      // reachable on a concurrent delete — reported as a 400 rather than
      // surfacing the Prisma constraint name.
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Referenced client, assigned user or product no longer exists.',
        );
      }
      // P2002: the composite unique on EnquiryProduct fired — the same
      // product was attached to the same enquiry twice. Pre-validated above,
      // so this is only reachable on concurrent writes; reported as a 400
      // rather than surfacing the Prisma constraint name.
      if (error.code === 'P2002') {
        throw new BadRequestException('That product is already attached to this enquiry.');
      }
      // P2025: the enquiry disappeared between the org-scoped read and the
      // write. Reported as 404 to stay consistent with the read path.
      if (error.code === 'P2025') {
        throw new NotFoundException('Enquiry not found.');
      }
    }
    this.logger.error('Unexpected error writing enquiry', error as Error);
    throw new InternalServerErrorException('Failed to save enquiry.');
  }

  private toSafeEnquiry(enquiry: EnquiryWithRelations): SafeEnquiry {
    return {
      id: enquiry.id,
      organizationId: enquiry.organizationId,
      title: enquiry.title,
      clientId: enquiry.clientId,
      // Both resolved from the real Client relation — nothing denormalized
      // onto the enquiry row. The schema has a single `companyName`, so
      // clientName and clientCompany intentionally carry the same value
      // rather than inventing a second column to back them.
      clientName: enquiry.client.companyName,
      clientCompany: enquiry.client.companyName,
      stage: enquiry.stage,
      expectedRevenue: Number(enquiry.expectedRevenue),
      probability: enquiry.probability,
      priority: enquiry.priority,
      source: enquiry.source,
      assignedTo: enquiry.assignedTo,
      description: enquiry.description,
      notes: enquiry.notes,
      expectedCloseDate: enquiry.expectedCloseDate,
      lostReason: enquiry.lostReason,
      tags: enquiry.tags,
      // Resolved from the Product relation on every read — the join row
      // stores only the ids, so nothing here can drift out of date.
      products: enquiry.enquiryProducts.map((link) => ({
        id: link.id,
        productId: link.product.id,
        name: link.product.name,
        productGroup: link.product.productGroup,
        price: Number(link.product.price),
        sku: link.product.sku,
        unit: link.product.unit,
        status: link.product.status,
      })),
      createdAt: enquiry.createdAt,
      updatedAt: enquiry.updatedAt,
    };
  }
}
