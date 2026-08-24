import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimIfString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * `q` is trimmed before validation so a whitespace-only query (e.g. "   ")
 * is correctly rejected by `@IsNotEmpty()` rather than silently treated as
 * empty. MaxLength keeps a caller from sending an enormous string into every
 * downstream `contains` filter.
 */
export class SearchQueryDto {
  @Transform(trimIfString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;
}
