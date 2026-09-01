import { Enquiry, EnquiryStage } from '@/types';
import { clients } from './clients';
import { users } from './users';

const stageDistribution: EnquiryStage[] = [
  ...Array(8).fill('new'),
  ...Array(7).fill('contacted'),
  ...Array(10).fill('follow-up'),
  ...Array(8).fill('quotation-sent'),
  ...Array(7).fill('negotiation'),
  ...Array(6).fill('won'),
  ...Array(4).fill('lost'),
];

// Enquiry.source is now a user-created, organization-scoped lookup — this
// unused mock data has no real EnquirySource ids to reference, so it just
// carries a plausible display name with sourceId left null.
const sourceNames = ['Website', 'Referral', 'Cold Call', 'Social Media', 'Trade Show'];
const titles = ['ERP Implementation', 'Cloud Migration', 'Cybersecurity Audit', 'Mobile App Dev', 'AI Integration', 'Data Pipeline Setup', 'CRM Customization', 'HRMS Upgrade'];

export const enquiries: Enquiry[] = stageDistribution.map((stage, i) => {
  const client = clients[i % clients.length];
  const assignedUser = users[4 + (i % 4)]; // Sales Executives
  const title = `${titles[i % titles.length]} for ${client.companyName}`;

  return {
    id: `e${i + 1}`,
    title,
    clientId: client.id,
    clientName: client.contacts[0]?.name ?? 'Unknown Contact',
    clientCompany: client.companyName,
    stage,
    expectedRevenue: 500000 + i * 200000,
    probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : 10 + (i % 8) * 10,
    priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
    sourceId: null,
    sourceName: sourceNames[i % sourceNames.length],
    assignedTo: assignedUser.id,
    assignedToName: assignedUser.name,
    // Enquiry.products is now a real EnquiryProduct[] resolved from the
    // backend's Product records; there are no invented product names here.
    products: [],
    expectedCloseDate: new Date(Date.now() + (10 + i) * 86400000).toISOString(),
    comments: [
      {
        id: `cmt${i}_1`,
        content: 'Initial inquiry received.',
        author: { id: assignedUser.id, name: assignedUser.name, role: 'Sales Executive' },
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
      {
        id: `cmt${i}_2`,
        content: 'Scheduled a discovery call.',
        author: { id: assignedUser.id, name: assignedUser.name, role: 'Sales Executive' },
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ],
    attachments: [],
    timeline: [
      {
        id: `te${i}_1`,
        type: 'system',
        title: 'Enquiry Created',
        description: 'Lead came through website.',
        timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
        user: { name: assignedUser.name },
      },
      {
        id: `te${i}_2`,
        type: 'system',
        title: 'Stage Updated',
        description: `Moved to ${stage}.`,
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        user: { name: assignedUser.name },
      },
    ],
    tags: [],
    createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});