import { IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';
import { ClientStatus } from '../../../generated/prisma/enums';

export class UpdateClientStatusDto {
  @IsEnum(ClientStatus)
  status!: ClientStatus;

  // Required only when deactivating (ACTIVE -> INACTIVE). Ignored by the
  // service when reactivating — the existing churnReason is preserved as
  // history rather than silently cleared or overwritten.
  @ValidateIf((dto: UpdateClientStatusDto) => dto.status === ClientStatus.INACTIVE)
  @IsString()
  @MinLength(1)
  churnReason?: string;
}
