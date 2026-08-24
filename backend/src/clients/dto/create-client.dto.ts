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

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  industry!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsEmail()
  email!: string;

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
