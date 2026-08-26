import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmailTemplateKey } from '../../../generated/prisma/enums';

// All optional — PATCH semantics are "omitted = unchanged" (see
// EmailTemplatesService.update). `key` may be changed, but the
// [organizationId, key] uniqueness constraint still applies (excluding the
// row being updated) — see EmailTemplatesService.mapWriteError.
export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsEnum(EmailTemplateKey)
  key?: EmailTemplateKey;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body?: string;
}
