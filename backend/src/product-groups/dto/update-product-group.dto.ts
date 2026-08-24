import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Excludes id/organizationId/createdAt/updatedAt (never client-settable) and
// status (its own dedicated endpoint, see UpdateProductGroupStatusDto).
export class UpdateProductGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
