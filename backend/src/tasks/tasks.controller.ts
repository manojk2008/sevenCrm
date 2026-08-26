import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
// ActiveUserGuard additionally rejects a session belonging to a user who has
// since been deactivated, exactly as on Follow-ups/Clients/Enquiries.
//
// There is deliberately no DELETE route: like Follow-ups, tasks are never
// hard-deleted — a task that's no longer relevant is simply marked COMPLETED
// through PATCH /tasks/:id/status.
//
// Row-level SALES_EXECUTIVE scoping (own tasks only) is enforced entirely in
// TasksService, not here — every method below passes the full session
// through unconditionally.
@Controller('tasks')
@UseGuards(ActiveUserGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @Session() session: AppSession) {
    return this.tasksService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListTasksQueryDto, @Session() session: AppSession) {
    return this.tasksService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.tasksService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Session() session: AppSession) {
    return this.tasksService.update(id, dto, session.user);
  }

  // The only route that changes `completed`/`completedAt` — see
  // UpdateTaskStatusDto.
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @Session() session: AppSession,
  ) {
    return this.tasksService.updateStatus(id, dto, session.user);
  }
}
