import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EnquiryStage, Priority } from '../../../generated/prisma/enums';

// Mirrors the filters the Enquiries UI actually exposes today (stage-based
// kanban/table views, a priority filter, and an assignee filter) plus real
// server-side pagination. pageSize is capped at 100, matching
// ListClientsQueryDto.
export class ListEnquiriesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(EnquiryStage)
  stage?: EnquiryStage;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

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
