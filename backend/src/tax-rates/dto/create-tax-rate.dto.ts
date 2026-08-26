import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// TaxRatesService.create), id/createdAt/updatedAt (never client-settable),
// and status (creation always starts ACTIVE — status transitions go
// through PATCH /tax-rates/:id/status, same convention as ProductGroup).
export class CreateTaxRateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
