import { ClientsContent } from '@/features/clients/clients-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clients',
  description: 'Manage your client portfolio',
};

export default function ClientsPage() {
  return <ClientsContent />;
}
