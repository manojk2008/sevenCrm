import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // The full CRM enum is accepted here for a clear validation error message;
  // SUPER_ADMIN is additionally rejected at the service layer (see
  // UsersService.create) since this API does not support creating further
  // Super Admins.
  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  department!: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
