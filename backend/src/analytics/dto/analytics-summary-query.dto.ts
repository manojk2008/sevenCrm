import { IsDateString, IsOptional } from 'class-validator';

/** Filters `Enquiry.createdAt` — mirrors SalesPeriodQueryDto's reasoning. */
export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
