import { QuotationsContent } from '@/features/quotations/quotations-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quotations' };

export default function QuotationsPage() {
  return <QuotationsContent />;
}
