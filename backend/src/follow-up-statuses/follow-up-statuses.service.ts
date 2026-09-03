import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { FollowUpStatusOptionState, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateFollowUpStatusOptionDto } from './dto/create-follow-up-status-option.dto';
import { UpdateFollowUpStatusOptionDto } from './dto/update-follow-up-status-option.dto';
import { UpdateFollowUpStatusOptionStateDto } from './dto/update-follow-up-status-option-state.dto';
import { ListFollowUpStatusOptionsQueryDto } from './dto/list-follow-up-status-options-query.dto';

type CurrentUser = AppSession['user'];

type FollowUpStatusOptionRow = Prisma.FollowUpStatusOptionGetPayload<Record<string, never>>;

export interface SafeFollowUpStatusOption {
  id: string;
  organizationId: string;
  name: string;
  status: FollowUpStatusOptionState;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization-scoped, user-creatable Follow-up status labels — see the
 * FollowUpStatusOption schema comment for the full "why" (deliberately
 * carries no lifecycle meaning; FollowUpStatus stays the only internal
 * state). Structurally this mirrors EnquirySourcesService (create/list, a
 * case-insensitive pre-check ahead of the DB unique constraint) blended
 * with ProductGroupsService's rename + activate/deactivate lifecycle (no
 * delete route — see the controller's own comment).
 */
@Injectable()
export class FollowUpStatusesService {
  private readonly logger = new Logger(FollowUpStatusesService.name);

  async create(
    dto: CreateFollowUpStatusOptionDto,
    currentUser: CurrentUser,
  ): Promise<SafeFollowUpStatusOption> {
    this.assertCanCreate(currentUser);

    const name = dto.name.trim();
    if (name.length === 0) {
      throw new ConflictException('Status name cannot be blank.');
    }

    // Explicit case-insensitive existence check before the write — lets a
    // caller who types "customer interested" against an existing "Customer
    // Interested" get a clean, specific message instead of a raw constraint
    // violation. Same pattern as EnquirySourcesService.create; the unique
    // index remains the backstop for a concurrent create of the exact same
    // casing.
    const existing = await prisma.followUpStatusOption.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `A follow-up status named "${existing.name}" already exists in your organization.`,
      );
    }

    try {
      const created = await prisma.followUpStatusOption.create({
        data: {
          organizationId: currentUser.organizationId,
          name,
          status: FollowUpStatusOptionState.ACTIVE,
        },
      });
      return this.toSafeOption(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListFollowUpStatusOptionsQueryDto,
  ): Promise<SafeFollowUpStatusOption[]> {
    this.assertCanRead(currentUser);

    const rows = await prisma.followUpStatusOption.findMany({
      where: {
        organizationId: currentUser.organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      // Alphabetical: this list populates a Select, not a management table
      // read in creation order.
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => this.toSafeOption(row));
  }

  async update(
    id: string,
    dto: UpdateFollowUpStatusOptionDto,
    currentUser: CurrentUser,
  ): Promise<SafeFollowUpStatusOption> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgOptionOrThrow(id, currentUser.organizationId);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length === 0) {
        throw new ConflictException('Status name cannot be blank.');
      }
      const duplicate = await prisma.followUpStatusOption.findFirst({
        where: {
          organizationId: currentUser.organizationId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: existing.id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `A follow-up status named "${duplicate.name}" already exists in your organization.`,
        );
      }
    }

    try {
      const updated = await prisma.followUpStatusOption.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        },
      });
      return this.toSafeOption(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /**
   * Activate/deactivate only — there is no delete route (see the
   * controller's own comment). Deactivating never touches any FollowUp
   * still referencing this option: the FK is untouched, so every historical
   * (and current) record keeps showing its recorded label exactly as
   * before. The only effect is that `findAllForOrg({ status: ACTIVE })` —
   * what every picker requests — stops offering it for a *new* selection,
   * the same "already-attached survives deactivation" precedent as
   * Product.status for EnquiryProduct/QuotationLineItem.
   */
  async updateStatus(
    id: string,
    dto: UpdateFollowUpStatusOptionStateDto,
    currentUser: CurrentUser,
  ): Promise<SafeFollowUpStatusOption> {
    this.assertCanManage(currentUser);
    const existing = await this.getOrgOptionOrThrow(id, currentUser.organizationId);

    const updated = await prisma.followUpStatusOption.update({
      where: { id: existing.id },
      data: { status: dto.status },
    });
    return this.toSafeOption(updated);
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // Create/read: all three roles — this is ordinary data a Sales Executive
  // enters constantly while working a Follow-up (the "+ Add option" flow
  // must be reachable by whoever is actually recording the outcome), same
  // tier as EnquirySource.
  //
  // Rename/deactivate: SUPER_ADMIN/ADMIN only — unlike create, these alter
  // or retire a label the whole organization shares, the same tier
  // ProductGroup/TaxRate use for their own settings-level changes. This is
  // a deliberate decision, not a default — see the Follow-up Status
  // implementation report for the full rationale.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to view follow-up statuses.');
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to create follow-up statuses.');
    }
  }

  private assertCanManage(currentUser: CurrentUser): void {
    if (currentUser.crmRole !== UserRole.SUPER_ADMIN && currentUser.crmRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Super Admin or Admin can manage follow-up statuses.');
    }
  }

  private hasCrmAccess(currentUser: CurrentUser): boolean {
    return (
      currentUser.crmRole === UserRole.SUPER_ADMIN ||
      currentUser.crmRole === UserRole.ADMIN ||
      currentUser.crmRole === UserRole.SALES_EXECUTIVE
    );
  }

  private async getOrgOptionOrThrow(
    id: string,
    organizationId: string,
  ): Promise<FollowUpStatusOptionRow> {
    // Never query by id alone — organizationId is part of the WHERE clause
    // so an option belonging to another org behaves as NOT FOUND, not 403,
    // and never leaks whether the id exists elsewhere. This is the actual
    // organization-isolation boundary for update/updateStatus.
    const option = await prisma.followUpStatusOption.findFirst({ where: { id, organizationId } });
    if (!option) {
      throw new NotFoundException('Follow-up status not found.');
    }
    return option;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Reachable only on a concurrent create/rename of the exact same
      // name/casing that raced past the pre-check above.
      throw new ConflictException(
        'A follow-up status with this name already exists in your organization.',
      );
    }
    this.logger.error('Unexpected error writing follow-up status option', error as Error);
    throw new InternalServerErrorException('Failed to save follow-up status.');
  }

  private toSafeOption(option: FollowUpStatusOptionRow): SafeFollowUpStatusOption {
    return {
      id: option.id,
      organizationId: option.organizationId,
      name: option.name,
      status: option.status,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    };
  }
}
