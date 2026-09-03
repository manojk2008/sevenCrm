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

// Deliberately excludes organizationId (must come from the session, see
// FollowUpsService.create), id/createdAt/updatedAt (system-managed),
// `status` (a new follow-up always starts SCHEDULED; changes go through
// PATCH /follow-ups/:id/status) and `completedAt` (generated server-side
// when the follow-up is completed, never client-supplied).
//
// clientId is required here and is verified to belong to the caller's
// organization by the service before the row is written.
export class CreateFollowUpDto {
  @IsString()
  @MinLength(1)
  clientId!: string;

  // Optional. When present the service additionally verifies it belongs to
  // the same organization AND the same client as `clientId` — an enquiry
  // belonging to a different client is a 400, not a silent link.
  @IsOptional()
  @IsString()
  @MinLength(1)
  enquiryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string;

  // Optional, organization-scoped business label (see FollowUpStatusOption).
  // Purely descriptive — never influences `status`, which always starts
  // SCHEDULED regardless of whether this is set. Verified by the service to
  // belong to the caller's organization and be ACTIVE before being attached.
  @IsOptional()
  @IsString()
  @MinLength(1)
  customStatusId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(FollowUpType)
  type!: FollowUpType;

  @IsEnum(Priority)
  priority!: Priority;

  // Full ISO-8601 datetime: a follow-up is scheduled to a point in time, not
  // a day. There is deliberately no separate date/time pair — the frontend
  // combines its date and time inputs into this single value.
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  // A plain flag with no notification delivery behind it in this phase — no
  // reminder *offset* is accepted, because none would be honoured.
  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
