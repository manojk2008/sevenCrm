import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Mirrors ListFollowUpsQueryDto/ListQuotationsQueryDto: real server-side
 * pagination with pageSize capped at 100.
 *
 * Unlike the revenue endpoints this filters `Enquiry.createdAt` — the only
 * honestly persisted timestamp on an enquiry. There is no `lostAt` column
 * (EnquiriesService.updateStage writes only `{ stage, lostReason }`), so
 * this is "enquiries *raised* in this period that are now LOST", never
 * "enquiries lost in this period".
 */
export class ListLostEnquiriesQueryDto {
  /** Inclusive lower bound on Enquiry.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound on Enquiry.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
