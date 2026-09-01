import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// ClientsService.create), status/churnReason (creation always starts
// ACTIVE — status transitions go through PATCH /clients/:id/status), and
// totalDeals/totalRevenue (system-calculated, always start at 0).
export class CreateClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  // Free text, optional — presented as "Category" in the UI. Any non-empty
  // value is accepted as-is; there is no fixed list to validate against
  // (see client-form.tsx, formerly a hardcoded Industry dropdown).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  // Genuinely optional: the TS type now matches the decorator (previously
  // `email!: string` claimed always-present despite @IsOptional(), which is
  // what let the service's dto.email.toLowerCase() crash on an omitted
  // value — see ClientsService.create).
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gstNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressCity!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressState!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  addressPincode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressCountry?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
