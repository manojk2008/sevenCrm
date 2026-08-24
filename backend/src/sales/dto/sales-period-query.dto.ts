import { IsDateString, IsOptional } from 'class-validator';

/**
 * Shared period filter for every Sales aggregation endpoint.
 *
 * IMPORTANT — what "period" means here.
 *
 * The database records no acceptance timestamp for a quotation:
 * QuotationsService.updateStatus writes only `{ status }`, and `updatedAt`
 * (Prisma `@updatedAt`) is bumped by *any* write — a line-item edit, a notes
 * change, a terms change. The status flow is also explicitly non-monotonic
 * ("No transition graph: any status may move to any other status"), so a
 * quotation can go ACCEPTED -> REJECTED -> ACCEPTED and `updatedAt` is not
 * even a lower bound on when acceptance happened.
 *
 * Therefore this range is applied to `Quotation.createdAt` — when the
 * quotation was *raised* — and every figure it filters is a raised-date
 * cohort metric: "accepted revenue from quotations raised in this period".
 * It is NOT "revenue closed/won in this period". No acceptance date is
 * fabricated anywhere in this module.
 *
 * Deliberately carries no `organizationId`: that always comes from the
 * authenticated session (see SalesService), and the global
 * `forbidNonWhitelisted` ValidationPipe rejects it outright if a caller
 * tries to supply one.
 */
export class SalesPeriodQueryDto {
  /** Inclusive lower bound on Quotation.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound on Quotation.createdAt. Full ISO-8601. */
  @IsOptional()
  @IsDateString()
  to?: string;
}
