import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * How many notifications to return. Mirrors RecentActivityQueryDto exactly
 * — Notifications is a presentation view over the same bounded feed, not a
 * paginated list, so page/pageSize would be over-engineering (Phase 9 scope
 * note).
 */
export class NotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
