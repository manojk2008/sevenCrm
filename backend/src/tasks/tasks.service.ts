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
import { Priority, UserRole } from '../../generated/prisma/enums';
import type { AppSession } from '../auth/session.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatusInput, UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';

type CurrentUser = AppSession['user'];

// Nothing (assignee name/email) is denormalized onto the task row — resolved
// here, on every read, same convention as FollowUp/Client/Enquiry.
const TASK_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export interface SafeTask {
  id: string;
  organizationId: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  title: string;
  dueDate: Date | null;
  priority: Priority | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTasks {
  data: SafeTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  async create(dto: CreateTaskDto, currentUser: CurrentUser): Promise<SafeTask> {
    this.assertCanCreate(currentUser);

    const assignedToId = await this.resolveAssignedToForCreate(dto.assignedToId, currentUser);

    try {
      const created = await prisma.task.create({
        data: {
          // Always from the session — never from the request body, which the
          // global forbidNonWhitelisted pipe rejects outright anyway.
          organizationId: currentUser.organizationId,
          assignedToId,
          title: dto.title,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          priority: dto.priority ?? null,
          // Not settable on create: a task always starts incomplete, and
          // completedAt only ever comes from the status endpoint.
          completed: false,
          completedAt: null,
        },
        include: TASK_INCLUDE,
      });
      return this.toSafeTask(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async findAllForOrg(currentUser: CurrentUser, query: ListTasksQueryDto): Promise<PaginatedTasks> {
    this.assertCanRead(currentUser);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;

    // Collected into an AND list rather than spread onto one object: keeps
    // `dueFrom`/`dueTo` from silently clobbering another key — same reasoning
    // as ListFollowUpsQueryDto's conditions array.
    const conditions: Prisma.TaskWhereInput[] = [];

    if (query.dueFrom || query.dueTo) {
      conditions.push({
        dueDate: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
        },
      });
    }

    if (query.search) {
      conditions.push({ title: { contains: query.search, mode: 'insensitive' } });
    }

    // A SALES_EXECUTIVE can never see another user's tasks — this is not a
    // convenience filter, it is the authorization boundary. The caller's own
    // `assignedToId` query value is never trusted for this: it is used only
    // when the caller has organization-wide visibility.
    const assignedToFilter = isSalesExec ? currentUser.id : query.assignedToId;

    const where: Prisma.TaskWhereInput = {
      organizationId: currentUser.organizationId,
      ...(query.completed !== undefined ? { completed: query.completed } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(assignedToFilter ? { assignedToId: assignedToFilter } : {}),
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        // Open tasks first, soonest-due first; `id` is a final tiebreaker so
        // ordering is fully deterministic even when every other column ties.
        orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSafeTask(row)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOneForOrg(id: string, currentUser: CurrentUser): Promise<SafeTask> {
    this.assertCanRead(currentUser);
    const task = await this.getOrgTaskOrThrow(id, currentUser);
    return this.toSafeTask(task);
  }

  async update(id: string, dto: UpdateTaskDto, currentUser: CurrentUser): Promise<SafeTask> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgTaskOrThrow(id, currentUser);

    let nextAssignedToId: string | null | undefined;
    if (dto.assignedToId !== undefined) {
      nextAssignedToId = await this.resolveAssignedToForUpdate(dto.assignedToId, currentUser);
    }

    try {
      const updated = await prisma.task.update({
        where: { id: existing.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(nextAssignedToId !== undefined ? { assignedToId: nextAssignedToId } : {}),
        },
        include: TASK_INCLUDE,
      });
      return this.toSafeTask(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    currentUser: CurrentUser,
  ): Promise<SafeTask> {
    this.assertCanUpdate(currentUser);
    const existing = await this.getOrgTaskOrThrow(id, currentUser);

    const completed = dto.status === TaskStatusInput.COMPLETED;

    try {
      const updated = await prisma.task.update({
        where: { id: existing.id },
        data: {
          completed,
          // Always stamped server-side, and always "now" — the DTO does not
          // even accept a completedAt, so a caller can never claim a
          // completion happened at a time of their choosing. Cleared when
          // moving back to PENDING, same reasoning as FollowUp.completedAt.
          completedAt: completed ? new Date() : null,
        },
        include: TASK_INCLUDE,
      });
      return this.toSafeTask(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Authorization
  //
  // All three roles get read/create/update — creating and completing one's
  // own tasks is ordinary day-to-day work, same tier as Follow-ups. What
  // differs from Follow-ups is *row-level* scoping: a SALES_EXECUTIVE's
  // reads/writes are additionally restricted to assignedToId = their own id,
  // enforced in findAllForOrg/getOrgTaskOrThrow, not by a blanket 403 here.
  // ---------------------------------------------------------------------

  private assertCanRead(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to view tasks.');
    }
  }

  private assertCanCreate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to create tasks.');
    }
  }

  private assertCanUpdate(currentUser: CurrentUser): void {
    if (!this.hasCrmAccess(currentUser)) {
      throw new ForbiddenException('You do not have permission to update tasks.');
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
  // Assignment resolution
  // ---------------------------------------------------------------------

  /**
   * Create-time assignedToId resolution. A SALES_EXECUTIVE's task is always
   * their own: an omitted value is forced to their id, and an explicit value
   * that isn't their own id is rejected outright (per the approved rule,
   * rejection is preferred over silently rewriting it). ADMIN/SUPER_ADMIN may
   * supply any user id in their organization, or omit it to leave the task
   * unassigned.
   */
  private async resolveAssignedToForCreate(
    assignedToId: string | undefined,
    currentUser: CurrentUser,
  ): Promise<string | null> {
    if (currentUser.crmRole === UserRole.SALES_EXECUTIVE) {
      if (assignedToId !== undefined && assignedToId !== currentUser.id) {
        throw new BadRequestException('You can only create tasks assigned to yourself.');
      }
      return currentUser.id;
    }

    if (assignedToId === undefined) {
      return null;
    }
    await this.assertAssignedUserInOrg(assignedToId, currentUser.organizationId);
    return assignedToId;
  }

  /**
   * Update-time assignedToId resolution, only called when the field is
   * present in the PATCH body at all. A SALES_EXECUTIVE may not change it to
   * anything but their own id (including unassigning it — they have no
   * unassign capability, only ADMIN/SUPER_ADMIN do). ADMIN/SUPER_ADMIN may
   * set it to any user in their organization or explicitly null it.
   */
  private async resolveAssignedToForUpdate(
    assignedToId: string | null,
    currentUser: CurrentUser,
  ): Promise<string | null> {
    if (currentUser.crmRole === UserRole.SALES_EXECUTIVE) {
      if (assignedToId !== currentUser.id) {
        throw new BadRequestException('You cannot reassign a task to another user.');
      }
      return currentUser.id;
    }

    if (assignedToId === null) {
      return null;
    }
    await this.assertAssignedUserInOrg(assignedToId, currentUser.organizationId);
    return assignedToId;
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

  // ---------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------

  /**
   * Never queries by id alone — organizationId is always part of the WHERE
   * clause so a task belonging to another org behaves as NOT FOUND, not 403,
   * and never leaks whether the id exists elsewhere. For a SALES_EXECUTIVE,
   * assignedToId = their own id is additionally part of the WHERE clause for
   * the same reason: another user's task in their own org is just as
   * indistinguishable from "does not exist".
   */
  private async getOrgTaskOrThrow(id: string, currentUser: CurrentUser): Promise<TaskWithRelations> {
    const isSalesExec = currentUser.crmRole === UserRole.SALES_EXECUTIVE;
    const task = await prisma.task.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        ...(isSalesExec ? { assignedToId: currentUser.id } : {}),
      },
      include: TASK_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }
    return task;
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: assignedToId pointed at a user that does not exist. Already
      // pre-validated above, so only reachable on a concurrent delete —
      // reported as 400 rather than surfacing the Prisma constraint name.
      if (error.code === 'P2003') {
        throw new BadRequestException('Assigned user no longer exists.');
      }
      // P2002: Task carries no unique constraint today, so this is currently
      // unreachable; handled anyway so a future constraint can never leak a
      // raw Prisma error to the client.
      if (error.code === 'P2002') {
        throw new BadRequestException('That task conflicts with an existing one.');
      }
      // P2025: the task disappeared between the org-scoped read and the
      // write. Reported as 404 to stay consistent with the read path.
      if (error.code === 'P2025') {
        throw new NotFoundException('Task not found.');
      }
    }
    this.logger.error('Unexpected error writing task', error as Error);
    throw new InternalServerErrorException('Failed to save task.');
  }

  private toSafeTask(task: TaskWithRelations): SafeTask {
    return {
      id: task.id,
      organizationId: task.organizationId,
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      completed: task.completed,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
