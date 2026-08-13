import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../../generated/prisma/enums';

// Intentionally excludes email, organizationId, and status:
// - email changes affect the Better Auth credential identity and are out of
//   scope for this phase.
// - organizationId must never be client-settable (see UsersService).
// - status has its own dedicated endpoint (PATCH /users/:id/status) because
//   it also toggles the Better Auth `banned` flag.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  department?: string;
}
