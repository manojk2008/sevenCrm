import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Priority } from '../../../generated/prisma/enums';

// PATCH semantics: an absent key means "leave this field exactly as it is".
//
// Intentionally excludes id, organizationId, createdAt and updatedAt (never
// client-settable) and completed/completedAt (status changes go through
// PATCH /tasks/:id/status only — mirrors UpdateFollowUpDto excluding
// status/outcome/completedAt for the same reason).
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  // null explicitly unassigns; undefined (key absent) leaves it untouched —
  // same convention as UpdateFollowUpDto.assignedToId. Whether a
  // SALES_EXECUTIVE may actually change this at all (they may not) is
  // enforced by TasksService.update, not this DTO.
  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
