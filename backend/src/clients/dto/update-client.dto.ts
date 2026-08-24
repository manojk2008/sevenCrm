import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Intentionally excludes organizationId, id, createdAt (never client-settable),
// and status/churnReason/totalDeals/totalRevenue:
// - status changes have their own dedicated endpoint (PATCH /clients/:id/status)
//   because INACTIVE requires churnReason — see UpdateClientStatusDto.
// - totalDeals/totalRevenue are system-calculated, never directly editable.
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  phone?: string;

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

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressCity?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressState?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  addressPincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressCountry?: string;

  // null explicitly unassigns; undefined (key absent) leaves it untouched.
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
