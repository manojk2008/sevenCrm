import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  // Exported so NotificationsModule can inject DashboardService and reuse
  // getRecentActivity's merge/sort logic rather than re-implementing the
  // same four-source query (Phase 9 decision — see NotificationsService).
  // Dashboard's own routes/behavior are unchanged by this export.
  exports: [DashboardService],
})
export class DashboardModule {}
