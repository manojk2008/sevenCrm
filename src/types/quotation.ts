// Phase 6C: aligned to the real backend contract (backend/src/quotations —
// QuotationStatus enum in schema.prisma). Previously this type declared
// 'pending' (the backend has no such status; it's 'sent') and a
// CGST/SGST/IGST tax breakdown (the backend's tax model is a single
// generic, industry-agnostic percentage — see QuotationLineItem.taxRate
// below), neither of which the real backend has ever produced.
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuotationLineItem {
  id: string;
  /** Null for an ad-hoc/custom line with no catalog Product behind it. */
  productId: string | null;
  /**
   * Historical snapshot taken when this line was created/last replaced —
   * never re-derived from the current Product on read. See
   * src/features/quotations/api.ts's doc comment for the full guarantee.
   */
  productName: string;
  description?: string;
  quantity: number;
  /** Historical snapshot — see productName above. */
  unitPrice: number;
  discountPercentage: number;
  /** Generic percentage (0-100). No GST/CGST/SGST/IGST assumption. */
  taxRate: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // server-generated, format QT-2026-0001
  clientId: string;
  clientName: string;
  enquiryId: string | null;
  enquiryTitle: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discountAmount: number;
  /** Flat total tax across all lines — see QuotationLineItem.taxRate. */
  taxAmount: number;
  grandTotal: number;
  validUntil: string | Date;
  notes?: string;
  terms?: string;
  status: QuotationStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};
