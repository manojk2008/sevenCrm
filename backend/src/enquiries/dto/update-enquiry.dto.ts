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
} from 'class-validator';
import { Priority } from '../../../generated/prisma/enums';

// Intentionally excludes id, organizationId, createdAt and updatedAt — none
// are ever client-settable. `stage`/`lostReason` are also excluded: stage
// changes go through PATCH /enquiries/:id/stage because moving to LOST
// requires a lostReason (see UpdateEnquiryStageDto), mirroring how Clients
// separates status changes from general edits.
//
// clientId is excluded as well: re-parenting an enquiry to a different
// client would rewrite its history, and no existing flow (frontend or
// otherwise) asks for it. Reassigning the owner via assignedToId is
// supported and is still organization-validated by the service.
export class UpdateEnquiryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  @Type(() => Number)
  expectedRevenue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  probability?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  // null explicitly clears the source; undefined (key absent) leaves it
  // untouched — same three-way convention as assignedToId below.
  @IsOptional()
  @IsString()
  @MinLength(1)
  sourceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // null explicitly unassigns; undefined (key absent) leaves it untouched.
  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  // The complete set of Products the enquiry should end up attached to.
  //
  // Absent key => the attached products are left exactly as they are, the
  // same undefined-means-untouched rule every other field here follows. A
  // present array replaces the set: ids not in it are detached, new ids are
  // attached, and ids already attached are left alone (so an already
  // attached INACTIVE product survives a save that still lists it — see
  // EnquiriesService.syncEnquiryProducts). An empty array detaches all.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  productIds?: string[];
}
