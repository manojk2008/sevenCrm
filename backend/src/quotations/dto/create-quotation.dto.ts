import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// A single quotation line. Two valid shapes (Phase 6B approved
// architecture):
//   - CATALOG: productId is set. productName/unitPrice are ignored by the
//     service — it snapshots the live Product's name/price instead, so a
//     client can never inject a fake snapshot for a real product.
//   - AD-HOC: productId is omitted. productName/unitPrice become the
//     snapshot values directly — for a non-catalog line, the client's
//     input IS the authoritative source, so it's required here.
export class CreateQuotationLineItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  productId?: string;

  @ValidateIf((dto: CreateQuotationLineItemDto) => !dto.productId)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productName?: string;

  @ValidateIf((dto: CreateQuotationLineItemDto) => !dto.productId)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // Decimal, not integer: mirrors QuotationLineItem.quantity — fractional
  // quantities (e.g. 2.5 hours) must be representable since Product.unit is
  // free-text and organization-defined.
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999.99)
  @Type(() => Number)
  quantity!: number;

  // Optional, defaults to 0 in the service — most lines have no discount and
  // forcing an explicit 0 on every request would be pure friction.
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercentage?: number;

  // Generic percentage-based tax field (Phase 6B: no CGST/SGST/IGST, no
  // hardcoded slabs — the organization decides the applicable rate).
  // Optional, defaults to 0.
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxRate?: number;
}

// Deliberately excludes organizationId (must come from the session, see
// QuotationsService.create), quotationNumber (server-generated), status
// (creation always starts DRAFT — status transitions go through
// PATCH /quotations/:id/status), and subtotal/discountAmount/taxAmount/
// grandTotal (server-calculated from lineItems, never client-supplied).
export class CreateQuotationDto {
  @IsString()
  @MinLength(1)
  clientId!: string;

  // Optional: a quotation can exist standalone (Client -> Quotation) or be
  // linked to the enquiry it was raised from (Client -> Enquiry ->
  // Quotation). Validated by the service to belong to the caller's
  // organization AND to the same client as this quotation.
  @IsOptional()
  @IsString()
  @MinLength(1)
  enquiryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedToId?: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationLineItemDto)
  lineItems!: CreateQuotationLineItemDto[];
}
