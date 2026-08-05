import { users } from './users';

export const dashboardData = {
  kpiMetrics: {
    totalClients: 25,
    totalProducts: 30,
    openEnquiries: 32,
    wonDeals: 6,
    monthlyRevenue: 12000000, // ₹1.2Cr
    conversionRate: 18.7
  },
  revenueData: [
    { month: 'Apr 2023', revenue: 4500000, previousYear: 3800000 },
    { month: 'May 2023', revenue: 5200000, previousYear: 4100000 },
    { month: 'Jun 2023', revenue: 4800000, previousYear: 4500000 },
    { month: 'Jul 2023', revenue: 6100000, previousYear: 5000000 },
    { month: 'Aug 2023', revenue: 5900000, previousYear: 5200000 },
    { month: 'Sep 2023', revenue: 7500000, previousYear: 6000000 },
    { month: 'Oct 2023', revenue: 8200000, previousYear: 6800000 },
    { month: 'Nov 2023', revenue: 9500000, previousYear: 7500000 },
    { month: 'Dec 2023', revenue: 11000000, previousYear: 8900000 },
    { month: 'Jan 2024', revenue: 10500000, previousYear: 9200000 },
    { month: 'Feb 2024', revenue: 13000000, previousYear: 10000000 },
    { month: 'Mar 2024', revenue: 15000000, previousYear: 11500000 }
  ],
  salesFunnelData: [
    { stage: 'New', count: 50, value: 50000000 },
    { stage: 'Contacted', count: 42, value: 42000000 },
    { stage: 'Quotation', count: 32, value: 35000000 },
    { stage: 'Negotiation', count: 20, value: 25000000 },
    { stage: 'Won', count: 12, value: 18000000 }
  ],
  pipelineData: [
    { name: 'New', value: 20 },
    { name: 'Follow-up', value: 30 },
    { name: 'Quotation Sent', value: 25 },
    { name: 'Negotiation', value: 15 },
    { name: 'Won', value: 10 }
  ],
  leadSourceData: [
    { source: 'Website', value: 35 },
    { source: 'Referral', value: 25 },
    { source: 'Cold Call', value: 15 },
    { source: 'Social Media', value: 10 },
    { source: 'Other', value: 15 }
  ],
  executiveLeaderboard: [
    { id: users[4].id, name: users[4].name, avatar: users[4].avatar, dealsWon: 15, revenue: 25000000, conversionRate: 22.5 },
    { id: users[5].id, name: users[5].name, avatar: users[5].avatar, dealsWon: 12, revenue: 18000000, conversionRate: 19.2 },
    { id: users[6].id, name: users[6].name, avatar: users[6].avatar, dealsWon: 10, revenue: 15000000, conversionRate: 16.8 },
    { id: users[7].id, name: users[7].name, avatar: users[7].avatar, dealsWon: 8, revenue: 12000000, conversionRate: 14.5 }
  ],
  recentActivities: [
    { id: 'a1', title: 'New Deal Won', description: 'Rajesh closed TCS account.', time: '2 hours ago', type: 'won' },
    { id: 'a2', title: 'Meeting Scheduled', description: 'Demo with Infosys tomorrow.', time: '4 hours ago', type: 'meeting' },
    { id: 'a3', title: 'Quotation Sent', description: 'QT-2024-0012 sent to Wipro.', time: '5 hours ago', type: 'quotation' },
    { id: 'a4', title: 'New Lead', description: 'Inbound lead from Zomato.', time: '1 day ago', type: 'lead' },
    { id: 'a5', title: 'Deal Lost', description: 'Lost bid for HDFC project.', time: '1 day ago', type: 'lost' },
    { id: 'a6', title: 'Payment Received', description: '₹5L received from Bajaj.', time: '2 days ago', type: 'payment' },
    { id: 'a7', title: 'Contract Signed', description: 'Godrej Industries signed NDA.', time: '2 days ago', type: 'contract' },
    { id: 'a8', title: 'Follow-up Overdue', description: 'Call Axis bank VP.', time: '3 days ago', type: 'alert' },
    { id: 'a9', title: 'System Update', description: 'v2.1 deployed successfully.', time: '4 days ago', type: 'system' },
    { id: 'a10', title: 'User Onboarded', description: 'Neha Gupta joined Sales.', time: '1 week ago', type: 'system' }
  ],
  monthlyComparison: {
    revenueIncrease: 12.5,
    newLeadsIncrease: 8.4,
    dealsWonIncrease: 15.2,
    conversionRateIncrease: 2.1
  },
  enquiryTrendData: [
    { month: 'Oct', website: 12, referral: 5, coldCall: 4 },
    { month: 'Nov', website: 15, referral: 6, coldCall: 3 },
    { month: 'Dec', website: 18, referral: 8, coldCall: 5 },
    { month: 'Jan', website: 14, referral: 7, coldCall: 4 },
    { month: 'Feb', website: 20, referral: 9, coldCall: 6 },
    { month: 'Mar', website: 25, referral: 12, coldCall: 8 }
  ]
};
