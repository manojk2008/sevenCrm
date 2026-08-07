import { FollowUp, FollowUpType, FollowUpStatus } from '@/types';
import { clients } from './clients';
import { users } from './users';

// 'upcoming' and 'today' both map to 'scheduled' — FollowUpStatus has no
// separate concept of "today"; that's a UI-level grouping you can compute
// from scheduledAt being within the next 24h, not a stored status value.
const statusDistribution: FollowUpStatus[] = [
  ...Array(10).fill('scheduled'), // was 'upcoming'
  ...Array(5).fill('scheduled'),  // was 'today'
  ...Array(8).fill('overdue'),
  ...Array(7).fill('completed'),
];

const types: FollowUpType[] = ['call', 'email', 'meeting', 'demo', 'visit'];

export const followUps: FollowUp[] = statusDistribution.map((status, i) => {
  const client = clients[i % clients.length];
  const assignedUser = users[4 + (i % 4)];
  const type = types[i % types.length];
  const clientContactName = client.contacts[0]?.name ?? 'Unknown Contact';

  let scheduledAt = new Date();
  if (status === 'scheduled') {
    scheduledAt = new Date(Date.now() + (1 + (i % 7)) * 86400000);
  } else if (status === 'overdue') {
    scheduledAt = new Date(Date.now() - (1 + (i % 7)) * 86400000);
  } else if (status === 'completed') {
    scheduledAt = new Date(Date.now() - (5 + (i % 10)) * 86400000);
  }

  return {
    id: `f${i + 1}`,
    clientId: client.id,
    clientName: clientContactName,
    subject: `Follow up on proposal - ${client.companyName}`,
    type,
    status,
    priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
    scheduledAt: scheduledAt.toISOString(),
    assignedTo: assignedUser.id,
    assignedToName: assignedUser.name,
    notes: 'Discuss the revised pricing and SLA terms.',
    outcome: status === 'completed' ? 'Client agreed to move to the next stage. Sending revised contract.' : undefined,
  };
});