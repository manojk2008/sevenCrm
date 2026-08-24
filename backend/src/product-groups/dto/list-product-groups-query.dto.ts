import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ProductGroupStatus } from '../../../generated/prisma/enums';

// Minimal, UI-driven filter surface (name search + status) plus real
// server-side pagination — mirrors ListClientsQueryDto/ListEnquiriesQueryDto.
export class ListProductGroupsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ProductGroupStatus)
  status?: ProductGroupStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
