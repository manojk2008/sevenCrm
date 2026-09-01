import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { UpdateFollowUpStatusDto } from './dto/update-follow-up-status.dto';
import { ListFollowUpsQueryDto } from './dto/list-follow-ups-query.dto';

// Authentication itself is enforced by Better Auth's global AuthGuard
// (registered via AuthModule.forRoot in app.module.ts) — every route below
// already requires a valid session with no further annotation needed.
// ActiveUserGuard additionally rejects a session belonging to a user who has
// since been deactivated, exactly as on Clients/Enquiries/Quotations.
//
// A called-off follow-up is still normally represented by status =
// CANCELLED, which keeps the interaction history intact. DELETE below is a
// separate, SUPER_ADMIN/ADMIN-only permanent-removal action — safe because
// FollowUp is a leaf record with no downstream FK dependencies (see
// FollowUpsService.delete).
@Controller('follow-ups')
@UseGuards(ActiveUserGuard)
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  create(@Body() dto: CreateFollowUpDto, @Session() session: AppSession) {
    return this.followUpsService.create(dto, session.user);
  }

  // Reuses CreateFollowUpDto's exact validation — the body shape is
  // identical to a normal create. What differs is entirely server-side:
  // this is the only route that produces isAutoManaged: true (see
  // FollowUpsService.createAutoManaged), and it exists specifically because
  // that flag must never be exposed as a settable field on the DTO the
  // manual Follow-up form's POST /follow-ups uses. Called only by the
  // Enquiry-sync frontend code (ensureNextFollowUp), under the same
  // session/permissions as any other authenticated request.
  @Post('auto-managed')
  createAutoManaged(@Body() dto: CreateFollowUpDto, @Session() session: AppSession) {
    return this.followUpsService.createAutoManaged(dto, session.user);
  }

  @Get()
  findAll(@Query() query: ListFollowUpsQueryDto, @Session() session: AppSession) {
    return this.followUpsService.findAllForOrg(session.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: AppSession) {
    return this.followUpsService.findOneForOrg(id, session.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFollowUpDto, @Session() session: AppSession) {
    return this.followUpsService.update(id, dto, session.user);
  }

  // The only route that changes `status`, because completing a follow-up
  // requires an `outcome` and stamps `completedAt` server-side — see
  // UpdateFollowUpStatusDto.
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpStatusDto,
    @Session() session: AppSession,
  ) {
    return this.followUpsService.updateStatus(id, dto, session.user);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Session() session: AppSession) {
    return this.followUpsService.delete(id, session.user);
  }
}
