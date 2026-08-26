import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts); ActiveUserGuard
// additionally rejects a session belonging to a deactivated user, exactly as
// on every other controller.
//
// Audit logs are immutable and GET-only by design (decision log item 6):
// there is no POST/PATCH/DELETE route here, and never will be — records are
// written exclusively by the Prisma Client Extension in audit.extension.ts.
//
// Row-level SALES_EXECUTIVE scoping (own actor events only) is enforced
// entirely in AuditLogsService, not here.
@Controller('audit-logs')
@UseGuards(ActiveUserGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Query() query: ListAuditLogsQueryDto,
    @Session() session: AppSession,
  ) {
    return this.auditLogsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.auditLogsService.findOneForOrg(id, session.user);
  }
}
