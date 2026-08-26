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
import { Priority } from '../../../generated/prisma/enums';

/**
 * Query strings carry no types, so `?completed=true` arrives as the string
 * "true" — converted here (and only for the two literal forms) so
 * `@IsBoolean()` still rejects anything else rather than silently treating
 * every non-empty string as truthy. Mirrors ListFollowUpsQueryDto's
 * toOptionalBoolean.
 */
function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

// Mirrors ListFollowUpsQueryDto: the filter surface the dashboard widget
// actually needs plus real server-side pagination, pageSize capped at 100.
//
// assignedToId here is a caller-supplied *filter* — for a SALES_EXECUTIVE it
// is never trusted for authorization. TasksService.findAllForOrg always
// forces `assignedToId: currentUser.id` into the WHERE clause for that role,
// regardless of what this field contains.
export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Inclusive lower/upper bounds on dueDate. Full ISO-8601 datetimes,
  // matching CreateTaskDto.dueDate.
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

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
