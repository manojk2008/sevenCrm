import { IsEnum } from 'class-validator';
import { FollowUpStatusOptionState } from '../../../generated/prisma/enums';

// Named `...State`, not `...Status`, specifically to avoid any reader
// confusion with FollowUpStatus (the internal lifecycle enum) or with
// UpdateFollowUpStatusDto (backend/src/follow-ups/dto) — a completely
// different, unrelated DTO on a different module. This one only ever
// activates/deactivates the option itself; it never touches any FollowUp.
export class UpdateFollowUpStatusOptionStateDto {
  @IsEnum(FollowUpStatusOptionState)
  status!: FollowUpStatusOptionState;
}
