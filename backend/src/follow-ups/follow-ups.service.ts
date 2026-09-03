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
  FollowUpStatus,
  FollowUpStatusOptionState,
  FollowUpType,
  Priority,
  UserRole,
} from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { UpdateFollowUpStatusDto } from './dto/update-follow-up-status.dto';
import { ListFollowUpsQueryDto } from './dto/list-follow-ups-query.dto';

type CurrentUser = AppSession['user'];

// Every relation the safe response exposes is resolved here, on every read.
// Nothing (client name, enquiry title, assignee name) is denormalized onto
// the follow_up row, so a renamed client or retitled enquiry is reflected
// immediately rather than drifting out of date.
const FOLLOW_UP_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  enquiry: { select: { id: true, title: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  // Resolved live, like every other relation here — a renamed
  // FollowUpStatusOption shows its current name immediately. Purely
  // descriptive; never read by any of the lifecycle logic in this service.
  customStatus: { select: { id: true, name: true } },
} satisfies Prisma.FollowUpInclude;

type FollowUpWithRelations = Prisma.FollowUpGetPayload<{ include: typeof FOLLOW_UP_INCLUDE }>;

export interface SafeFollowUp {
  id: string;
  organizationId: string;
  clientId: string;
  client: { id: string; companyName: string };
  enquiryId: string | null;
  enquiry: { id: string; title: string } | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  subject: string;
  description: string | null;
  type: FollowUpType;
  priority: Priority;
  status: FollowUpStatus;
  scheduledAt: Date;
  completedAt: Date | null;
  outcome: string | null;
  notes: string | null;
  reminder: boolean;
  /**
   * Organization-customizable business label — purely descriptive, carries
   * no lifecycle meaning of its own. `null` for a Follow-up nothing has
   * ever set one on (including every auto-managed row — see isAutoManaged
   * below). Resolved live from the FollowUpStatusOption relation, never
   * denormalized.
   */
  customStatusId: string | null;
  customStatus: { id: string; name: string } | null;
  /**
   * True only for the single Follow-up an Enquiry's Next-follow-up-date
   * automatically manages (see ensureNextFollowUp in the frontend). Never
   * settable through CreateFollowUpDto/UpdateFollowUpDto — see `create` vs
   * `createAutoManaged` below — so a manually-created Follow-up can never
   * carry this as true.
   */
  isAutoManaged: boolean;
  /**
   * Derived, never stored — see the FollowUp model comment in schema.prisma.
   * True only while the follow-up is still SCHEDULED and its scheduled time
   * has already passed; a COMPLETED or CANCELLED follow-up is never overdue,
   * however far in the past it was scheduled.
   */
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedFollowUps {
  data: SafeFollowUp[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger(FollowUpsService.name);

  async create(dto: CreateFollowUpDto, currentUser: CurrentUser): Promise<SafeFollowUp> {
    return this.createRaw(dto, currentUser, false);
  }

  /**
   * The only way a Follow-up is ever created with `isAutoManaged: true`.
   * Deliberately a separate method (and separate route — see
   * FollowUpsController.createAutoManaged) rather than a flag on
   * CreateFollowUpDto: that DTO is validated with the global
   * `forbidNonWhitelisted` pipe, so a client sending `isAutoManaged` in a
   * normal `POST /follow-ups` body is rejected outright, not silently
   * accepted. This method is reachable only via the dedicated
   * `POST /follow-ups/auto-managed` route the Enquiry-sync frontend code
   * calls — there is no way for the manual Follow-up form to reach it.
   * Shares every other validation/creation rule with `create` via
   * `createRaw`.
   */
  async createAutoManaged(dto: CreateFollowUpDto, currentUser: CurrentUser): Promise<SafeFollowUp> {
    return this.createRaw(dto, currentUser, true);
  }

  private async createRaw(
    dto: CreateFollowUpDto,
    currentUser: CurrentUser,
    isAutoManaged: boolean,
  ): Promise<SafeFollowUp> {
    this.assertCanCreate(currentUser);

    await this.assertClientInOrg(dto.clientId, currentUser);
    if (dto.enquiryId) {
      await this.assertEnquiryUsable(dto.enquiryId, dto.clientId, currentUser.organizationId);
    }
    if (dto.assignedToId) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }
    if (dto.customStatusId) {
      await this.assertCustomStatusOptionUsable(dto.customStatusId, currentUser.organizationId);
    }

    try {
      const created = await prisma.followUp.create({
        data: {
          // Always from the session — never from the request body, which the
          // global forbidNonWhitelisted pipe rejects outright anyway.
          organizationId: currentUser.organizationId,
          clientId: dto.clientId,
          enquiryId: dto.enquiryId ?? null,
          assignedToId: dto.assignedToId ?? null,
          // Never set by createAutoManaged's caller (ensureNextFollowUp) —
          // stays null for every auto-managed row, exactly as required.
          customStatusId: dto.customStatusId ?? null,
          subject: dto.subject,
          description: dto.description,
          type: dto.type,
          priority: dto.priority,
          // Not settable on create: a follow-up always starts SCHEDULED, and
          // completedAt/outcome only ever come from the status endpoint.
          status: FollowUpStatus.SCHEDULED,
          scheduledAt: new Date(dto.scheduledAt),
          notes: dto.notes,
          reminder: dto.reminder ?? false,
          // Never from `dto` — see this method's own doc comment and
          // createAutoManaged's.
          isAutoManaged,
        },
        include: FOLLOW_UP_INCLUDE,
      });
      return this.toSafeFollowUp(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListFollowUpsQueryDto,
  ): Promise<PaginatedFollowUps> {
    this.assertCanRead(currentUser);
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Filters that can each contribute their own `OR`/`scheduledAt` clause
    // are collected into an AND list rather than spread onto one object:
    // spreading would let the last one silently overwrite an earlier key
    // (e.g. `search` clobbering the `overdue=false` OR, or `overdue=true`
    // clobbering a scheduledFrom/scheduledTo range) and quietly widen the
    // result set.
    const conditions: Prisma.FollowUpWhereInput[] = [];

    if (query.scheduledFrom || query.scheduledTo) {
      conditions.push({
        scheduledAt: {
          ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
          ...(query.scheduledTo ? { lte: new Date(query.scheduledTo) } : {}),
        },
      });
    }

    const overdueCondition = this.overdueWhere(query.overdue);
    if (overdueCondition) {
      conditions.push(overdueCondition);
    }

    if (query.search) {
      // Covers what a follow-up row / calendar entry actually shows: its own
      // subject and the owning client's company name.
      conditions.push({
        OR: [
          { subject: { contains: query.search, mode: 'insensitive' } },
          { client: { companyName: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.FollowUpWhereInput = {
      organizationId: currentUser.organizationId,
      // Sales Executive ownership rule (Phase 19): client ownership is
      // authoritative — FollowUp.assignedToId is deliberately NOT used as
      // the visibility boundary. Additive to organizationId above, never a
      // replacement of it.
      ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.enquiryId ? { enquiryId: query.enquiryId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      // Boolean, so `!== undefined` (not truthiness) — `isAutoManaged=false`
      // must still filter, same reasoning as `overdue` below.
      ...(query.isAutoManaged !== undefined ? { isAutoManaged: query.isAutoManaged } : {}),
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: FOLLOW_UP_INCLUDE,
        // Chronological, unlike the other modules' createdAt-desc default: a
        // follow-up list and a calendar are both read by *when the work is
        // due*, not by when the record happened to be typed in.
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.followUp.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeFollowUp(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeFollowUp> {
    this.assertCanRead(currentUser);
    const followUp = await this.getOrgFollowUpOrThrow(id, currentUser);
    return this.toSafeFollowUp(followUp);
  }

  async update(id: string, dto: UpdateFollowUpDto, currentUser: CurrentUser): Promise<SafeFollowUp> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgFollowUpOrThrow(id, currentUser);

    // Re-validated against the follow-up's *existing* clientId: clientId is
    // not editable (see UpdateFollowUpDto), so the client can never be moved
    // out from under an enquiry link in the same request.
    if (dto.enquiryId !== undefined && dto.enquiryId !== null) {
      await this.assertEnquiryUsable(dto.enquiryId, existing.clientId, currentUser.organizationId);
    }
    if (dto.assignedToId !== undefined && dto.assignedToId !== null) {
      await this.assertAssignedUserInOrg(dto.assignedToId, currentUser.organizationId);
    }
    if (dto.customStatusId !== undefined && dto.customStatusId !== null) {
      await this.assertCustomStatusOptionUsable(dto.customStatusId, currentUser.organizationId);
    }

    try {
      const updated = await prisma.followUp.update({
        where: { id: existing.id },
        data: {
          ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.scheduledAt !== undefined ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.reminder !== undefined ? { reminder: dto.reminder } : {}),
          ...(dto.enquiryId !== undefined ? { enquiryId: dto.enquiryId } : {}),
          ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
          ...(dto.customStatusId !== undefined ? { customStatusId: dto.customStatusId } : {}),
        },
        include: FOLLOW_UP_INCLUDE,
      });
      return this.toSafeFollowUp(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateFollowUpStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeFollowUp> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgFollowUpOrThrow(id, currentUser);

    if (dto.customStatusId !== undefined) {
      await this.assertCustomStatusOptionUsable(dto.customStatusId, currentUser.organizationId);
    }

    // `status` is always the caller-supplied internal value, exactly as
    // before this field existed — customStatusId (if present) is recorded
    // alongside it but never derives or overrides it. See
    // UpdateFollowUpStatusDto's own doc comment.
    const data: Prisma.FollowUpUpdateInput = {
      status: dto.status,
      ...(dto.customStatusId !== undefined ? { customStatusId: dto.customStatusId } : {}),
    };

    if (dto.status === FollowUpStatus.COMPLETED) {
      // DTO validation (ValidateIf) already guarantees a non-empty string;
      // the trim check additionally rejects a whitespace-only outcome.
      this.assertOutcomePresent(dto.outcome);
      data.outcome = dto.outcome;
      // Always stamped server-side, and always "now" — the DTO does not even
      // accept a completedAt, so a caller can never claim a completion
      // happened at a time of their choosing.
      data.completedAt = new Date();
    } else {
      // Moving away from COMPLETED clears completedAt. Unlike Enquiry's
      // lostReason this is not narrative history but a factual claim ("this
      // was completed at T"), and leaving it set on a SCHEDULED or CANCELLED
      // follow-up would make that claim untrue — it would also make the row
      // contradict its own isOverdue derivation. `outcome` *is* preserved,
      // following the lostReason/churnReason precedent: it records what
      // happened and is never fabricated or silently cleared.
      data.completedAt = null;
    }

    try {
      const updated = await prisma.followUp.update({
        where: { id: existing.id },
        data,
        include: FOLLOW_UP_INCLUDE,
      });
      return this.toSafeFollowUp(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /**
   * Permanent removal — distinct from updateStatus's CANCELLED, which
   * keeps the record and its history. No pre-check is needed: FollowUp is
   * a leaf record with no downstream FK dependencies (nothing references a
   * FollowUp), so deleting one can never orphan or cascade into any other
   * business record. Works the same for an automatically-created initial
   * follow-up as for any other.
   */
  async delete(id: string, currentUser: CurrentUser): Promise<{ id: string }> {
    this.assertCanDelete(currentUser);
    const existing = await this.getOrgFollowUpOrThrow(id, currentUser);

    try {
      await prisma.followUp.delete({ where: { id: existing.id } });
    } catch (error) {
      throw this.mapWriteError(error);
    }
    return { id: existing.id };
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // All three roles get read/create/update on follow-ups. Scheduling and
  // completing a follow-up is ordinary day-to-day sales work — it is the
  // primary interaction of this module for a Sales Executive — so there is
  // no narrower admin-only tier here (unlike Quotations, where writes are
  // ADMIN and above).
  //
  // Phase 19: a Sales Executive is additionally scoped to follow-ups whose
  // CLIENT is assigned to them (findAllForOrg/getOrgFollowUpOrThrow, via the
  // client relation), and create() validates dto.clientId the same way.
  // FollowUp.assignedToId is deliberately NOT the visibility boundary and
  // remains freely settable to any org user, exactly as before.
  //
  // SALES_MANAGER is deliberately not referenced: it is not a value of
  // UserRole and introducing one would be a new, unapproved role concept.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to view follow-ups.');
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to create follow-ups.');
    }
  }

  private assertCanUpdate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to update follow-ups.');
    }
  }

  // Narrower than hasCrmAccess: permanent deletion is SUPER_ADMIN/ADMIN
  // only, unlike the ordinary day-to-day schedule/complete/cancel work
  // every Sales Executive performs — same tier as
  // ClientsService.assertCanDelete / ProductsService.assertCanDelete /
  // EnquiriesService.assertCanDelete.
  private assertCanDelete(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can delete a follow-up.');
    }
  }

  private hasCrmAccess(currentUser: CurrentUser): boolean {
    return (
      currentUser.crmRole === UserRole.SUPER_ADMIN ||
      currentUser.crmRole === UserRole.ADMIN ||
      currentUser.crmRole === UserRole.SALES_EXECUTIVE
    );
  }

  // ---------------------------------------------------------------------
  // Relationship validation
  // ---------------------------------------------------------------------

  private assertOutcomePresent(outcome: string | undefined): void {
    if (!outcome || outcome.trim().length === 0) {
      throw new BadRequestException('outcome is required when a follow-up is marked COMPLETED.');
    }
  }

  private async assertClientInOrg(clientId: string, currentUser: CurrentUser): Promise<void> {
    // Scoped by organizationId so a client in another org is indistinguishable
    // from one that does not exist — same non-leaking behaviour as the
    // follow-up lookup itself. Sales Executive ownership rule (Phase 19):
    // also scoped to the caller's own clients — creation-time business
    // validation on a caller-supplied clientId (a 400), not a single-record
    // id-probing scenario (which stays a 404 in getOrgFollowUpOrThrow).
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

  /**
   * Validates that enquiryId belongs to the caller's organization AND to the
   * same client as the follow-up. Both checks live here because neither is
   * expressible as a foreign key (Postgres cannot enforce
   * "followUp.organizationId = enquiry.organizationId", let alone
   * "followUp.clientId = enquiry.clientId") — mirrors
   * QuotationsService.assertEnquiryUsable.
   */
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
      throw new BadRequestException('enquiryId must belong to the same client as this follow-up.');
    }
  }

  private async assertAssignedUserInOrg(
    assignedToId: string,
    organizationId: string,
  ): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId } });
    if (!user) {
      throw new BadRequestException('assignedToId must reference a user in your organization.');
    }
  }

  /**
   * Validates a customStatusId for a *new* attachment: must belong to the
   * caller's organization and be ACTIVE — same "attach only if active"
   * precedent as EnquiriesService.assertProductsAttachable. An option that
   * is already attached to a Follow-up and has since been deactivated is
   * never re-validated (it never reaches this method again unless the
   * caller explicitly picks a *different* value), which is what lets a
   * historical record keep its recorded label after the option retires.
   */
  private async assertCustomStatusOptionUsable(
    customStatusId: string,
    organizationId: string,
  ): Promise<void> {
    const option = await prisma.followUpStatusOption.findFirst({
      where: { id: customStatusId, organizationId },
    });
    if (!option) {
      throw new BadRequestException(
        'customStatusId must reference a follow-up status in your organization.',
      );
    }
    if (option.status === FollowUpStatusOptionState.INACTIVE) {
      throw new BadRequestException('This follow-up status has been deactivated.');
    }
  }

  private async getOrgFollowUpOrThrow(
    id: string,
    currentUser: CurrentUser,
  ): Promise<FollowUpWithRelations> {
    // Never query by id alone — organizationId is part of the WHERE clause so
    // a follow-up belonging to another org behaves as NOT FOUND, not 403, and
    // never leaks whether the id exists elsewhere. Sales Executive ownership
    // rule (Phase 19): the same additive condition via the client relation,
    // never FollowUp.assignedToId — another rep's client's follow-up (or one
    // on an unassigned client) is likewise NOT FOUND, never a 403.
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const followUp = await prisma.followUp.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { client: { assignedToId: currentUser.id } } : {}),
      },
      include: FOLLOW_UP_INCLUDE,
    });
    if (!followUp) {
      throw new NotFoundException('Follow-up not found.');
    }
    return followUp;
  }

  // ---------------------------------------------------------------------
  // Derived "overdue"
  // ---------------------------------------------------------------------

  /**
   * Expands the `overdue` query flag into the same condition
   * `toSafeFollowUp` derives `isOverdue` from, so a filtered list and the
   * flags on its own rows can never disagree.
   *
   * `overdue=false` is the exact complement (not SCHEDULED, or scheduled at
   * or after now), not merely "scheduled in the future" — so overdue=true and
   * overdue=false together always cover the whole result set.
   *
   * Returns null (not `{}`) when the filter is absent, so the caller can tell
   * "no condition" apart from "an empty condition" without inspecting keys.
   */
  private overdueWhere(overdue: boolean | undefined): Prisma.FollowUpWhereInput | null {
    if (overdue === undefined) return null;
    const now = new Date();
    if (overdue) {
      return { status: FollowUpStatus.SCHEDULED, scheduledAt: { lt: now } };
    }
    return {
      OR: [{ status: { not: FollowUpStatus.SCHEDULED } }, { scheduledAt: { gte: now } }],
    };
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: a foreign key (clientId / enquiryId / assignedToId /
      // customStatusId) pointed at a row that does not exist. All four are
      // pre-validated above, so this is only reachable on a concurrent
      // delete — reported as a 400 rather than surfacing the Prisma
      // constraint name.
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Referenced client, enquiry, assigned user or follow-up status no longer exists.',
        );
      }
      // P2002: FollowUp carries no unique constraint today, so this is
      // currently unreachable; handled anyway so a future constraint can
      // never leak a raw Prisma error to the client.
      if (error.code === 'P2002') {
        throw new BadRequestException('That follow-up conflicts with an existing one.');
      }
      // P2025: the follow-up disappeared between the org-scoped read and the
      // write. Reported as 404 to stay consistent with the read path.
      if (error.code === 'P2025') {
        throw new NotFoundException('Follow-up not found.');
      }
    }
    this.logger.error('Unexpected error writing follow-up', error as Error);
    throw new InternalServerErrorException('Failed to save follow-up.');
  }

  private toSafeFollowUp(followUp: FollowUpWithRelations): SafeFollowUp {
    return {
      id: followUp.id,
      organizationId: followUp.organizationId,
      clientId: followUp.clientId,
      // Resolved from the real relations on every read — nothing is
      // denormalized onto the follow_up row.
      client: followUp.client,
      enquiryId: followUp.enquiryId,
      enquiry: followUp.enquiry,
      assignedToId: followUp.assignedToId,
      assignedTo: followUp.assignedTo,
      subject: followUp.subject,
      description: followUp.description,
      type: followUp.type,
      priority: followUp.priority,
      status: followUp.status,
      scheduledAt: followUp.scheduledAt,
      completedAt: followUp.completedAt,
      outcome: followUp.outcome,
      notes: followUp.notes,
      reminder: followUp.reminder,
      customStatusId: followUp.customStatusId,
      customStatus: followUp.customStatus,
      isAutoManaged: followUp.isAutoManaged,
      isOverdue:
        followUp.status === FollowUpStatus.SCHEDULED && followUp.scheduledAt.getTime() < Date.now(),
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
    };
  }
}
