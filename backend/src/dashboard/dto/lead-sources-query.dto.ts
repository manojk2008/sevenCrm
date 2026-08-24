import { IsDateString, IsOptional } from 'class-validator';

/**
 * Period filter for the lead-sources breakdown. Filters `Enquiry.createdAt`
 * — the only honestly persisted timestamp on an Enquiry (mirrors
 * SalesPeriodQueryDto's reasoning in backend/src/sales/dto).
 */
export class LeadSourcesQueryDto {
  /** Inclusive lower bound on Enquiry.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound on Enquiry.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  to?: string;
}
