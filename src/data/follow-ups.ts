import { FollowUp } from '@/types';
import { clients } from './clients';
import { users } from './users';

const statuses = [
  ...Array(10).fill('upcoming'),
  ...Array(5).fill('today'),
  ...Array(8).fill('overdue'),
  ...Array(7).fill('completed')
];
const types = ['Call', 'Email', 'Meeting', 'Demo', 'Visit'];

export const followUps: FollowUp[] = statuses.map((status, i) => {
  const client = clients[i % clients.length];
  const assignedUser = users[4 + (i % 4)];
  const type = types[i % types.length];
  
  let scheduledAt = new Date();
  if (status === 'upcoming') {
    scheduledAt = new Date(Date.now() + (1 + (i % 7)) * 86400000);
  } else if (status === 'overdue') {
    scheduledAt = new Date(Date.now() - (1 + (i % 7)) * 86400000);
  } else if (status === 'completed') {
    scheduledAt = new Date(Date.now() - (5 + (i % 10)) * 86400000);
  }
  
  return {
    id: `f${i + 1}`,
    clientId: client.id,
    clientName: client.name,
    subject: `Follow up on proposal - ${client.name}`,
    type: type as any,
    status: status as any,
    priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
    scheduledAt: scheduledAt.toISOString(),
    assignedToId: assignedUser.id,
    notes: 'Discuss the revised pricing and SLA terms.',
    outcome: status === 'completed' ? 'Client agreed to move to the next stage. Sending revised contract.' : undefined,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  };
});
