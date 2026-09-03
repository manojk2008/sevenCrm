import { Module } from '@nestjs/common';
import { FollowUpStatusesController } from './follow-up-statuses.controller';
import { FollowUpStatusesService } from './follow-up-statuses.service';

@Module({
  controllers: [FollowUpStatusesController],
  providers: [FollowUpStatusesService],
})
export class FollowUpStatusesModule {}
