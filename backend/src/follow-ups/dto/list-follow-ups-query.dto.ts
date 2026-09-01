import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FollowUpStatus, FollowUpType, Priority } from '../../../generated/prisma/enums';

/**
 * Query strings carry no types, so `?overdue=true` arrives as the string
 * "true". Converted here (and only for the two literal forms) so
 * `@IsBoolean()` still rejects anything else rather than silently treating
 * every non-empty string as truthy.
 */
function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

// Mirrors ListClientsQueryDto/ListEnquiriesQueryDto/ListQuotationsQueryDto:
// the filter surface the Follow-ups UI actually exposes (list *and*
// calendar — both are driven by the same query) plus real server-side
// pagination, pageSize capped at 100.
export class ListFollowUpsQueryDto {
  // Matches against the follow-up's subject and the owning client's company
  // name — the two things a row/calendar entry actually shows.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(FollowUpStatus)
  status?: FollowUpStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(FollowUpType)
  type?: FollowUpType;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  enquiryId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Lets the Enquiry-sync frontend code (ensureNextFollowUp) find the one
  // auto-managed Follow-up for an enquiryId server-side, rather than
  // downloading every Follow-up for it and filtering in the browser. Same
  // boolean-coercion need as `overdue` below — query strings arrive as
  // literal "true"/"false" strings.
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isAutoManaged?: boolean;

  // Inclusive lower/upper bounds on scheduledAt. Full ISO-8601 datetimes,
  // matching CreateFollowUpDto.scheduledAt — the calendar sends the first
  // and last instant of the visible range.
  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledTo?: string;

  /**
   * `overdue=true` is shorthand for the derived state, not a stored column:
   * the service expands it to `status = SCHEDULED AND scheduledAt < now()`.
   * `overdue=false` is its exact complement (anything that is not currently
   * overdue), so the two together always cover the whole result set.
   */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  overdue?: boolean;

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
