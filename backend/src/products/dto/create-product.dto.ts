import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// ProductsService.create) and status (creation always starts ACTIVE —
// status transitions go through PATCH /products/:id/status).
export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  productGroupId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  // maxDecimalPlaces mirrors the column's Decimal(14,2) so a value with more
  // precision than the database can store is rejected up front rather than
  // being silently rounded on write — same pattern as Enquiry.expectedRevenue.
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  @Type(() => Number)
  price!: number;

  // Optional, no uniqueness, no fabricated max length — approved Phase 5B
  // decision: SKU format varies too much across industries to constrain.
  @IsOptional()
  @IsString()
  sku?: string;

  // Optional, no fixed enum/max length — units are organization-defined
  // (piece, kg, hour, license, service, ...).
  @IsOptional()
  @IsString()
  unit?: string;
}
