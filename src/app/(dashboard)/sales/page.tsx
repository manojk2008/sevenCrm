import { SalesContent } from '@/features/sales/sales-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sales Overview' };

export default function SalesPage() {
  return <SalesContent />;
}
