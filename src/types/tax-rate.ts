/**
 * Mirrors SafeTaxRate in backend/src/tax-rates/tax-rates.service.ts,
 * translated to this codebase's lower-case status convention by
 * src/features/tax-rates/api.ts — same pattern as Product/ProductGroup.
 */
export interface TaxRate {
  id: string;
  organizationId: string;
  name: string;
  /** Percentage, 0-100, up to 2 decimal places. */
  rate: number;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
