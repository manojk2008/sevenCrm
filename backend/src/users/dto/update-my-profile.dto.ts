import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Self-service profile editing (PATCH /users/me) only. Deliberately excludes
// id, userId, organizationId, role, email, createdAt, and updatedAt — the
// global forbidNonWhitelisted ValidationPipe rejects any of those outright,
// and the identity used for the update comes exclusively from the
// authenticated session, never from this body.
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  department?: string;
}
