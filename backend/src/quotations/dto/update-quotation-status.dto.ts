import { IsEnum } from 'class-validator';
import { QuotationStatus } from '../../../generated/prisma/enums';

// Mirrors UpdateProductStatusDto exactly: a single-field status change with
// no companion "reason" field. Unlike Client.churnReason/Enquiry.lostReason,
// nothing in the approved Phase 6B spec requires a reason for
// REJECTED/EXPIRED, so none is invented here.
export class UpdateQuotationStatusDto {
  @IsEnum(QuotationStatus)
  status!: QuotationStatus;
}
