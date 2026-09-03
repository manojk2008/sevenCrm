import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { FollowUpStatus } from '../../../generated/prisma/enums';

// The only way a follow-up's status ever changes.
//
// `completedAt` is deliberately absent: it is generated server-side the
// moment the status becomes COMPLETED (see FollowUpsService.updateStatus),
// so a caller can never claim a completion happened at a time of their
// choosing.
export class UpdateFollowUpStatusDto {
  @IsEnum(FollowUpStatus)
  status!: FollowUpStatus;

  // Required only when completing. `@MinLength(1)` combined with the
  // service's trim check rejects both a missing and a blank/whitespace-only
  // outcome. Ignored by the service for the other transitions — an existing
  // outcome is preserved as history rather than cleared or fabricated,
  // matching how Enquiries treats lostReason and Clients treats churnReason.
  @ValidateIf((dto: UpdateFollowUpStatusDto) => dto.status === FollowUpStatus.COMPLETED)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  outcome?: string;

  // Optional, organization-scoped business label recorded alongside this
  // status change (see FollowUpStatusOption) — purely descriptive, never
  // read by the logic above. `status` is always the caller-supplied
  // internal value, exactly as before; this field never derives or
  // overrides it. Verified by the service to belong to the caller's
  // organization and be ACTIVE before being attached.
  @IsOptional()
  @IsString()
  @MinLength(1)
  customStatusId?: string;
}
