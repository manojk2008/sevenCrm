import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Priority } from '../../../generated/prisma/enums';

// Deliberately excludes organizationId (must come from the session, see
// TasksService.create), id/createdAt/updatedAt (system-managed), and
// completed/completedAt (a new task always starts incomplete; completion
// goes through PATCH /tasks/:id/status — mirrors CreateFollowUpDto excluding
// status/completedAt for the same reason).
//
// assignedToId is intentionally unrestricted here: whether it may be
// supplied, must equal the caller, or is forced server-side depends on the
// caller's role and is enforced in TasksService.create, not the DTO.
export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
