import { ClientDetailContent } from '@/features/clients/client-detail-content';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClientDetailContent params={params} />;
}
