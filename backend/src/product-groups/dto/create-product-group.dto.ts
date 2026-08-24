import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Deliberately excludes organizationId (must come from the session, see
// ProductGroupsService.create) and status (creation always starts ACTIVE —
// status transitions go through PATCH /product-groups/:id/status).
export class CreateProductGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
