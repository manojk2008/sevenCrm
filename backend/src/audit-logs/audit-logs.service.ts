import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '../auth/auth';
import { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import type { AuditAction } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

type CurrentUser = AppSession['user'];

export interface SafeAuditLogActor {
  id: string;
  name: string;
  email: string;
}

export interface SafeAuditLogListItem {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actor: SafeAuditLogActor | null;
  entityLabel: string | null;
  createdAt: Date;
}

export interface SafeAuditLogDetail extends SafeAuditLogListItem {
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
}

export interface PaginatedAuditLogs {
  data: SafeAuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type AuditLogRow = Prisma.AuditLogGetPayload<Record<string, never>>;

@Injectable()
export class AuditLogsService {
  async findAllForOrg(
    currentUser: CurrentUser,
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedAuditLogs> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where = this.buildWhere(currentUser, query);

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        // createdAt DESC, id DESC as a deterministic tiebreaker — see the
        // decision log's ordering requirement. createdAt alone is not
        // guaranteed unique (two events in the same millisecond).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItem(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(
    id: string,
    currentUser: CurrentUser,
  ): Promise<SafeAuditLogDetail> {
    this.assertCanRead(currentUser);

    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    // Never queried by id alone — organizationId (and, for a
    // SALES_EXECUTIVE, actorId) is always part of the WHERE clause, so a log
    // outside the caller's visibility behaves as NOT FOUND rather than 403
    // and never leaks whether the id exists elsewhere. Same pattern as
    // TasksService.getOrgTaskOrThrow.
    const row = await prisma.auditLog.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { actorId: currentUser.id } : {}),
      },
    });
    if (!row) {
      throw new NotFoundException('Audit log not found.');
    }

    return {
      ...this.toListItem(row),
      before: row.before,
      after: row.after,
    };
  }

  // ---------------------------------------------------------------------
  // Authorization
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (
      currentUser.crmRole !== UserRole.SUPER_ADMIN &&
      currentUser.crmRole !== UserRole.ADMIN &&
      currentUser.crmRole !== UserRole.SALES_EXECUTIVE
    ) {
      throw new ForbiddenException(
        'You do not have permission to view audit logs.',
      );
    }
  }

  // ---------------------------------------------------------------------
  // Query building
  // ---------------------------------------------------------------------

  private buildWhere(
    currentUser: CurrentUser,
    query: ListAuditLogsQueryDto,
  ): Prisma.AuditLogWhereInput {
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    // A SALES_EXECUTIVE can only ever see their own actor events — this is
    // not a convenience filter, it is the authorization boundary. The
    // caller's own `actorId` query value is never trusted for this: it is
    // used only when the caller has organization-wide visibility (SUPER_ADMIN
    // / ADMIN). Same pattern as TasksService.findAllForOrg.
    const actorFilter = isSalesExec ? currentUser.id : query.actorId;

    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (query.dateFrom || query.dateTo) {
      conditions.push({
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
        },
      });
    }
    if (query.search) {
      conditions.push({
        OR: [
          { entityLabel: { contains: query.search, mode: 'insensitive' } },
          { actorName: { contains: query.search, mode: 'insensitive' } },
          { actorEmail: { contains: query.search, mode: 'insensitive' } },
          { entityId: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      // organizationId always comes from the authenticated session — never
      // from a query parameter.
      organizationId: currentUser.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(actorFilter ? { actorId: actorFilter } : {}),
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    };
  }

  // ---------------------------------------------------------------------
  // Shaping
  // ---------------------------------------------------------------------

  /**
   * Builds `actor` from the actorName/actorEmail snapshot columns, not a
   * live join to User — that snapshot is the whole point of keeping those
   * columns (see the AuditLog model comment in schema.prisma): it stays
   * accurate even after the user is renamed, and stays present even after
   * the user is deleted (actorId goes null via SetNull, but the snapshot
   * survives).
   */
  private toListItem(row: AuditLogRow): SafeAuditLogListItem {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actor: row.actorId
        ? {
            id: row.actorId,
            name: row.actorName ?? '',
            email: row.actorEmail ?? '',
          }
        : null,
      entityLabel: row.entityLabel,
      createdAt: row.createdAt,
    };
  }
}
