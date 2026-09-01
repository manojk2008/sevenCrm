import { IsString, MaxLength, MinLength } from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// EnquirySourcesService.create) and id/createdAt/updatedAt (never
// client-settable). There is no status field to exclude, unlike
// ProductGroup/TaxRate — a source has no deactivate/reactivate lifecycle in
// this phase, only create-and-list.
export class CreateEnquirySourceDto {
  // @MinLength(1) combined with the service's own trim check rejects both a
  // missing and a whitespace-only name — the same pattern used for
  // lostReason/outcome elsewhere in this codebase.
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
