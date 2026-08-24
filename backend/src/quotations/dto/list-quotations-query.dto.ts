import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QuotationStatus } from '../../../generated/prisma/enums';

// Mirrors ListClientsQueryDto/ListEnquiriesQueryDto/ListProductsQueryDto:
// the filter surface the approved API spec calls for (search, status,
// clientId, enquiryId) plus real server-side pagination, pageSize capped at
// 100.
export class ListQuotationsQueryDto {
  // Matches against quotationNumber and the client's companyName — same
  // "what the UI would actually surface on a row" reasoning as
  // ListEnquiriesQueryDto.search.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  enquiryId?: string;

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
