import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ClientStatus } from '../../../generated/prisma/enums';

// Mirrors what clients-content.tsx actually uses today (search text +
// status filter) plus real server-side pagination — not the full mock
// filter surface, and not client-side sorting, which the current UI
// doesn't wire up to sortable columns.
export class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

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
