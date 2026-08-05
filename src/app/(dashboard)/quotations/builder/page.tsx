import { QuotationBuilder } from '@/features/quotations/quotation-builder';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quotation Builder' };

export default function QuotationBuilderPage() {
  return <QuotationBuilder />;
}
