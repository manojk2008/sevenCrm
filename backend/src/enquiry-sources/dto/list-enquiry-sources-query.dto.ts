import { IsOptional, IsString, MaxLength } from 'class-validator';

// Deliberately no pagination, unlike ListTaxRatesQueryDto/
// ListProductGroupsQueryDto: this endpoint exists to populate the Enquiry
// form's Source dropdown with the organization's full list in one request,
// not to paginate a management table — there is no such table in this
// phase. `search` is kept anyway for parity with the other list DTOs and
// costs nothing to support.
export class ListEnquirySourcesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
