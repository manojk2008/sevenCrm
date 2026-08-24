import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { DashboardService } from './dashboard.service';
import { LeadSourcesQueryDto } from './dto/lead-sources-query.dto';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';

// Authentication is enforced by Better Auth's global AuthGuard; ActiveUserGuard
// additionally rejects a deactivated user's session, exactly as on every
// other completed module. Dashboard is READ-ONLY — no @Post/@Patch/@Delete
// routes exist, and organizationId always comes from `session.user`, never
// from a route/query parameter (the global forbidNonWhitelisted
// ValidationPipe rejects any attempt to supply one).
//
// This controller deliberately does NOT re-expose revenue, acceptance-rate,
// enquiry-conversion, or enquiry-stage-breakdown figures — those already
// exist on /sales/* and the frontend calls that API directly rather than
// this module recomputing them (Phase 8 decision D6).
@Controller('dashboard')
@UseGuards(ActiveUserGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Session() session: AppSession) {
    return this.dashboardService.getSummary(session.user);
  }

  @Get('lead-sources')
  getLeadSources(@Query() query: LeadSourcesQueryDto, @Session() session: AppSession) {
    return this.dashboardService.getLeadSources(session.user, query);
  }

  @Get('recent-activity')
  getRecentActivity(@Query() query: RecentActivityQueryDto, @Session() session: AppSession) {
    return this.dashboardService.getRecentActivity(session.user, query);
  }

  @Get('monthly-comparison')
  getMonthlyComparison(@Session() session: AppSession) {
    return this.dashboardService.getMonthlyComparison(session.user);
  }
}
