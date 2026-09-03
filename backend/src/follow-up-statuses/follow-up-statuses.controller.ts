import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { FollowUpStatusesService } from './follow-up-statuses.service';
import { CreateFollowUpStatusOptionDto } from './dto/create-follow-up-status-option.dto';
import { UpdateFollowUpStatusOptionDto } from './dto/update-follow-up-status-option.dto';
import { UpdateFollowUpStatusOptionStateDto } from './dto/update-follow-up-status-option-state.dto';
import { ListFollowUpStatusOptionsQueryDto } from './dto/list-follow-up-status-options-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
//
// Deliberately no DELETE route — same reasoning as ProductGroup/TaxRate: a
// FollowUp already referencing an option must never lose its recorded
// label, and the FK backs this up (onDelete: SetNull would only ever fire
// on a delete that this API doesn't expose). Deactivation (status ->
// INACTIVE) is the lifecycle mechanism instead — see
// FollowUpStatusesService.updateStatus.
@Controller('follow-up-statuses')
@UseGuards(ActiveUserGuard)
export class FollowUpStatusesController {
  constructor(private readonly followUpStatusesService: FollowUpStatusesService) {}

  @Post()
  create(@Body() dto: CreateFollowUpStatusOptionDto, @Session() session: AppSession) {
    return this.followUpStatusesService.create(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListFollowUpStatusOptionsQueryDto, @Session() session: AppSession) {
    return this.followUpStatusesService.findAllForOrg(session.user, query);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpStatusOptionDto,
    @Session() session: AppSession,
  ) {
    return this.followUpStatusesService.update(id, dto, session.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpStatusOptionStateDto,
    @Session() session: AppSession,
  ) {
    return this.followUpStatusesService.updateStatus(id, dto, session.user);
  }
}
