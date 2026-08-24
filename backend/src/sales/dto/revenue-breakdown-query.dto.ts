import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SalesPeriodQueryDto } from './sales-period-query.dto';

/**
 * The period filter plus a top-N cap, for the three "revenue by X"
 * breakdowns (client / product / representative).
 *
 * These endpoints return a ranked breakdown rather than a page of rows, so
 * they take `limit` instead of the `page`/`pageSize` pair the list
 * endpoints use. The cap mirrors the `@Max(100)` pageSize ceiling every
 * other List*QueryDto in this codebase enforces.
 */
export class RevenueBreakdownQueryDto extends SalesPeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
