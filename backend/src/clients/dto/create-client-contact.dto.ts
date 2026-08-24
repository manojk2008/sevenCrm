import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// clientId/organizationId are deliberately absent — derived from the route
// (:id) and the authenticated session, never accepted from the client.
export class CreateClientContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  designation?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
