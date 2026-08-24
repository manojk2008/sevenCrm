import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { AppSession } from '../auth/session.types';
import { ActiveUserGuard } from '../users/guards/active-user.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';

// Same conventions as DashboardController/SalesController: Better Auth's
// global AuthGuard + ActiveUserGuard, READ-ONLY (no write routes),
// organizationId always from `session.user`. Revenue/win-rate/average-deal
// figures are intentionally NOT re-exposed here — the frontend reads them
// from GET /sales/summary directly (Phase 8 decision D6).
@Controller('analytics')
@UseGuards(ActiveUserGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@Query() query: AnalyticsSummaryQueryDto, @Session() session: AppSession) {
    return this.analyticsService.getSummary(session.user, query);
  }
}
