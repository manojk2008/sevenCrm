import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuditAction } from '../../../generated/prisma/enums';
import { AUDITED_ENTITY_TYPES } from '../entity-config';

// Mirrors ListTasksQueryDto/ListFollowUpsQueryDto: the filter surface the
// approved decision log specifies, plus real server-side pagination,
// pageSize capped at 100.
//
// actorId here is a caller-supplied *filter* — for a SALES_EXECUTIVE it is
// never trusted for authorization. AuditLogsService.findAllForOrg always
// forces `actorId: currentUser.id` into the WHERE clause for that role,
// regardless of what this field contains (same pattern as
// ListTasksQueryDto.assignedToId).
export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  // entityType is a validated string, not a Prisma enum (see
  // AUDITED_ENTITY_TYPES) — `IsIn` is that validation.
  @IsOptional()
  @IsIn(AUDITED_ENTITY_TYPES)
  entityType?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

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
