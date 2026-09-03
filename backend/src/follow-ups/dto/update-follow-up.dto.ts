import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FollowUpType, Priority } from '../../../generated/prisma/enums';

// PATCH semantics: an absent key means "leave this field exactly as it is".
//
// Intentionally excludes id, organizationId, createdAt and updatedAt (never
// client-settable), `status` and `outcome` (status changes go through
// PATCH /follow-ups/:id/status, because completing a follow-up requires an
// outcome — mirroring how Enquiries separates stage changes from general
// edits) and `completedAt` (server-generated on completion; allowing it here
// would let a caller claim a follow-up was completed at an arbitrary time).
//
// clientId is excluded as well: re-parenting a follow-up to a different
// client would invalidate its enquiry link and rewrite its history, the same
// reasoning that keeps clientId out of UpdateEnquiryDto/UpdateQuotationDto.
export class UpdateFollowUpDto {
  // null explicitly unlinks the enquiry; undefined (key absent) leaves it
  // untouched. A non-null value is re-validated against the follow-up's
  // existing clientId by the service.
  @IsOptional()
  @IsString()
  @MinLength(1)
  enquiryId?: string | null;

  // null explicitly unassigns; undefined (key absent) leaves it untouched.
  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string | null;

  // null explicitly clears the business label; undefined (key absent)
  // leaves it untouched. A non-null value is re-validated by the service
  // (caller's organization, ACTIVE) — see FollowUpStatusOption. Purely
  // descriptive: never touches `status`.
  @IsOptional()
  @IsString()
  @MinLength(1)
  customStatusId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(FollowUpType)
  type?: FollowUpType;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
