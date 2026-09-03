import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FollowUpStatusOptionState } from '../../../generated/prisma/enums';

// No pagination, same reasoning as ListEnquirySourcesQueryDto: this exists
// to populate a Select with the organization's full list in one request
// (the manage-statuses UI, when it exists, would use the same route without
// a status filter), not to paginate a large table.
export class ListFollowUpStatusOptionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // The Follow-up Status pickers request `?status=ACTIVE` so a deactivated
  // option never appears as a *new* selection, while a management view can
  // omit this to see everything, including inactive rows.
  @IsOptional()
  @IsEnum(FollowUpStatusOptionState)
  status?: FollowUpStatusOptionState;
}
