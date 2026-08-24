import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EnquirySource, EnquiryStage, Priority } from '../../../generated/prisma/enums';

// Deliberately excludes organizationId (must come from the session, see
// EnquiriesService.create) and createdAt/updatedAt (system-managed).
// clientId is required here and is verified to belong to the caller's
// organization by the service before the row is written.
export class CreateEnquiryDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  // Optional on create: omitting it lets the database default (NEW) apply,
  // which is the schema's declared starting stage.
  @IsOptional()
  @IsEnum(EnquiryStage)
  stage?: EnquiryStage;

  // maxDecimalPlaces mirrors the column's Decimal(14,2) so a value with
  // more precision than the database can store is rejected up front rather
  // than being silently rounded on write.
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  @Type(() => Number)
  expectedRevenue!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  probability!: number;

  @IsEnum(Priority)
  priority!: Priority;

  @IsEnum(EnquirySource)
  source!: EnquirySource;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsDateString()
  expectedCloseDate!: string;

  // Only meaningful for a LOST enquiry. Validated conditionally so creating
  // an enquiry directly in LOST still has to explain why, matching the
  // stage-transition rule in UpdateEnquiryStageDto.
  @ValidateIf((dto: CreateEnquiryDto) => dto.stage === EnquiryStage.LOST)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  lostReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // The Products this enquiry is about. Optional — an enquiry can be logged
  // before the specific products are known — but never a list of product
  // *names*: these are stable Product ids, each verified by the service to
  // exist in the caller's organization and to be ACTIVE before an
  // EnquiryProduct row is written. Duplicates within the array are rejected
  // rather than silently de-duplicated. The size cap mirrors the pageSize
  // ceiling used across the list DTOs.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  productIds?: string[];
}
