import { FollowUpsContent } from '@/features/follow-ups/follow-ups-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Follow-ups' };

export default function FollowUpsPage() {
  return <FollowUpsContent />;
}
