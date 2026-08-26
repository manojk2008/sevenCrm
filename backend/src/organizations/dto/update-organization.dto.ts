import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Self-service "current organization" settings (PATCH /organizations/me)
// only. Deliberately excludes id, organizationId, slug, createdAt, and
// updatedAt — the global forbidNonWhitelisted ValidationPipe rejects any of
// those outright, and the target organization comes exclusively from the
// authenticated session, never from this body. No MaxLength on email:
// matches the existing convention (see clients' DTOs), which never pairs
// @IsEmail with a length cap.
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gstNumber?: string;

  // Branding (Phase 17, P1 scope) — see the Organization model comment in
  // schema.prisma for why these four fields only (no logo/favicon).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  quotationHeaderText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quotationFooterText?: string;
}
