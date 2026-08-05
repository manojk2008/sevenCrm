import { Notification } from '@/types';
import { users } from './users';

const types = ['enquiry', 'follow-up', 'quotation', 'deal', 'system', 'task'];
const messages = [
  'New lead assigned to you from TCS.',
  'Reminder: Demo scheduled with Infosys at 3 PM.',
  'Quotation QT-2024-0005 has been accepted!',
  'Deal won: AI Analytics Platform for Wipro.',
  'System maintenance scheduled for tonight 2 AM.',
  'Task overdue: Send NDA to HDFC Bank.'
];

export const notifications: Notification[] = Array.from({ length: 50 }).map((_, i) => {
  const type = types[i % types.length];
  const isRead = i >= 15; // 30% unread (15/50)
  const actor = users[1 + (i % 3)]; // Random actor
  
  return {
    id: `n${i + 1}`,
    title: `Notification ${i + 1}`,
    message: messages[i % messages.length],
    type: type as any,
    read: isRead,
    href: '/dashboard',
    actorId: actor.id,
    actorName: actor.name,
    createdAt: new Date(Date.now() - (i % 7) * 86400000).toISOString()
  };
});
