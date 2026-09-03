import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Rename only. Excludes id/organizationId/createdAt/updatedAt (never
// client-settable) and status (its own dedicated endpoint, see
// UpdateFollowUpStatusOptionStateDto) — mirrors UpdateProductGroupDto.
export class UpdateFollowUpStatusOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
