import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { EnquiryStage } from '../../../generated/prisma/enums';

export class UpdateEnquiryStageDto {
  @IsEnum(EnquiryStage)
  stage!: EnquiryStage;

  // Required only when moving to LOST. `@MinLength(1)` combined with the
  // service's trim check rejects both a missing and a blank/whitespace-only
  // reason. Ignored by the service when moving away from LOST — the
  // existing lostReason is preserved as history rather than fabricated or
  // silently cleared, matching how Clients treats churnReason on
  // reactivation.
  @ValidateIf((dto: UpdateEnquiryStageDto) => dto.stage === EnquiryStage.LOST)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  lostReason?: string;
}
