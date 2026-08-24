import { QuotationDetailContent } from '@/features/quotations/quotation-detail';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quotation Details' };

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <QuotationDetailContent params={params} />;
}
