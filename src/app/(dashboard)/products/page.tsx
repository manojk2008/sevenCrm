import { ProductsContent } from '@/features/products/products-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return <ProductsContent />;
}
