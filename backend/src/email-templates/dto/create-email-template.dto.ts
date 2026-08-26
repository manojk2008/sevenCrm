import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { EmailTemplateKey } from '../../../generated/prisma/enums';

// Deliberately excludes organizationId (must come from the session, see
// EmailTemplatesService.create) and id/createdAt/updatedAt (never
// client-settable). `key` identifies which of the closed set of trigger
// points this template is for — validated against the real Prisma enum,
// not a free-text string.
export class CreateEmailTemplateDto {
  @IsEnum(EmailTemplateKey)
  key!: EmailTemplateKey;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}
