import { FollowUpsContent } from '@/features/follow-ups/follow-ups-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New Follow-up' };

// Renders the Follow-ups page with its create dialog already open, so the
// /follow-ups/new link (command palette, dashboard quick actions) reaches the
// real create flow instead of 404ing. Closing the dialog returns to
// /follow-ups — there is no separate create screen to maintain.
export default function NewFollowUpPage() {
  return <FollowUpsContent initialCreateOpen />;
}
