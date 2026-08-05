import { Enquiry } from '@/types';
import { clients } from './clients';
import { users } from './users';

const stageDistribution = [
  ...Array(8).fill('New'),
  ...Array(7).fill('Contacted'),
  ...Array(10).fill('Follow-up'),
  ...Array(8).fill('Quotation Sent'),
  ...Array(7).fill('Negotiation'),
  ...Array(6).fill('Won'),
  ...Array(4).fill('Lost')
];

const sources = ['Website', 'Referral', 'Cold Call', 'Social Media', 'Trade Show'];
const titles = ['ERP Implementation', 'Cloud Migration', 'Cybersecurity Audit', 'Mobile App Dev', 'AI Integration', 'Data Pipeline Setup', 'CRM Customization', 'HRMS Upgrade'];

export const enquiries: Enquiry[] = stageDistribution.map((stage, i) => {
  const client = clients[i % clients.length];
  const assignedUser = users[4 + (i % 4)]; // Sales Executives
  const title = `${titles[i % titles.length]} for ${client.name}`;
  
  return {
    id: `e${i + 1}`,
    title,
    clientId: client.id,
    assignedToId: assignedUser.id,
    stage: stage as any,
    expectedRevenue: 500000 + (i * 200000), // ₹5L to ₹1Cr+
    probability: stage === 'Won' ? 100 : stage === 'Lost' ? 0 : 10 + (i % 8) * 10,
    priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
    source: sources[i % sources.length] as any,
    comments: [
      { id: `cmt${i}_1`, text: 'Initial inquiry received.', authorId: assignedUser.id, createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
      { id: `cmt${i}_2`, text: 'Scheduled a discovery call.', authorId: assignedUser.id, createdAt: new Date(Date.now() - 86400000 * 5).toISOString() }
    ],
    timelineEvents: [
      { id: `te${i}_1`, title: 'Enquiry Created', description: 'Lead came through website.', date: new Date(Date.now() - 86400000 * 10).toISOString(), type: 'created' },
      { id: `te${i}_2`, title: 'Stage Updated', description: `Moved to ${stage}.`, date: new Date(Date.now() - 86400000 * 2).toISOString(), type: 'stage_change' }
    ],
    createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString()
  };
});
