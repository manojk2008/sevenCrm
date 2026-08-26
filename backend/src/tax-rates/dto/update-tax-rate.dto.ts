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

// Same field set as CreateTaxRateDto, all optional — PATCH semantics are
// "omitted = unchanged" (see TaxRatesService.update). Deliberately excludes
// status — that only ever changes through PATCH /tax-rates/:id/status.
export class UpdateTaxRateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
