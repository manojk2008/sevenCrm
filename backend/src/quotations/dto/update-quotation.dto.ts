import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateQuotationLineItemDto } from './create-quotation.dto';

// Identical to CreateQuotationLineItemDto plus an optional `id`. When `id`
// matches an existing line on this quotation AND productId is unchanged
// from what that line already has, QuotationsService.update preserves that
// line's existing productNameSnapshot/unitPriceSnapshot rather than
// re-resolving them from the current Product — only quantity/
// discountPercentage/taxRate (and therefore lineAmount) are recomputed. This
// is what keeps re-saving a quotation from silently refreshing an untouched
// line's historical price/name to the catalog's current values. Omitting
// `id` (a brand-new line) or changing `productId` from what the matched
// line had always triggers a fresh snapshot — see resolveLineItemsForUpdate.
export class UpdateQuotationLineItemDto extends CreateQuotationLineItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  id?: string;
}

// Intentionally excludes id, organizationId, quotationNumber, status,
// createdAt, updatedAt (never client-settable) and subtotal/discountAmount/
// taxAmount/grandTotal (always re-derived server-side from lineItems).
// status changes go through PATCH /quotations/:id/status (see
// UpdateQuotationStatusDto), mirroring Clients/Enquiries/Products.
//
// clientId is excluded as well: re-parenting a quotation to a different
// client would rewrite its history, and no existing flow asks for it —
// same reasoning UpdateEnquiryDto uses to exclude clientId.
//
// lineItems, when present, is treated as the COMPLETE replacement set for
// this quotation (see QuotationsService.update) — not a partial patch. A
// line matched by `id` (see UpdateQuotationLineItemDto) whose productId is
// unchanged keeps its existing snapshot; every other line (new, or with a
// changed productId) is freshly resolved/snapshotted, exactly as on create.
// Lines already on the quotation are left completely untouched — including
// their historical snapshots — whenever the `lineItems` key is absent from
// the request at all.
export class UpdateQuotationDto {
  // null explicitly unlinks the enquiry; undefined (key absent) leaves it
  // untouched. Same convention as Client.assignedToId / Enquiry.assignedToId.
  @IsOptional()
  @IsString()
  @MinLength(1)
  enquiryId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UpdateQuotationLineItemDto)
  lineItems?: UpdateQuotationLineItemDto[];
}
