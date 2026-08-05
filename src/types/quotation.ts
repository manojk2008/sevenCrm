export type QuotationStatus = 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired';

export interface QuotationLineItem {
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxRate: number; // GST
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // format QT-2024-0001
  clientId: string;
  clientName: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  grandTotal: number;
  validUntil: string | Date;
  notes?: string;
  terms?: string;
  status: QuotationStatus;
  createdBy: string;
  sentAt?: string | Date;
  acceptedAt?: string | Date;
}

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};
