import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Excludes id/organizationId/createdAt/updatedAt (never client-settable) and
// status (its own dedicated endpoint, see UpdateProductStatusDto).
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  // Re-validated against the caller's organization (and against the
  // group's own status) by the service only when this key is actually
  // present — same pattern as Client.assignedToId/Enquiry.assignedToId.
  @IsOptional()
  @IsString()
  @MinLength(1)
  productGroupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}
