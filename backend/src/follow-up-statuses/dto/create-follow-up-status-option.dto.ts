import { IsString, MaxLength, MinLength } from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// FollowUpStatusesService.create), id/createdAt/updatedAt (never
// client-settable), and `status` (a new option always starts ACTIVE — see
// UpdateFollowUpStatusOptionStateDto for the separate deactivate route).
//
// There is no `systemState`/lifecycle field here by design: a
// FollowUpStatusOption is a pure business label the organization defines
// for itself. FollowUp.status (SCHEDULED/COMPLETED/CANCELLED) remains the
// only internal lifecycle value and is never derived from this option.
export class CreateFollowUpStatusOptionDto {
  // @MinLength(1) combined with the service's own trim check rejects both a
  // missing and a whitespace-only name — same pattern as
  // CreateEnquirySourceDto.name.
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
