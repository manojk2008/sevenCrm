import { IsEnum } from 'class-validator';
import { TaxRateStatus } from '../../../generated/prisma/enums';

export class UpdateTaxRateStatusDto {
  @IsEnum(TaxRateStatus)
  status!: TaxRateStatus;
}
