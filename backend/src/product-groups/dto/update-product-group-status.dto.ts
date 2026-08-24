import { IsEnum } from 'class-validator';
import { ProductGroupStatus } from '../../../generated/prisma/enums';

export class UpdateProductGroupStatusDto {
  @IsEnum(ProductGroupStatus)
  status!: ProductGroupStatus;
}
