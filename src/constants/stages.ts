export const ENQUIRY_STAGES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-800' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-100 text-orange-800' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
] as const;

export const FOLLOW_UP_TYPES = [
  { value: 'call', label: 'Call', icon: 'Phone' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'meeting', label: 'Meeting', icon: 'Users' },
  { value: 'demo', label: 'Demo', icon: 'Video' },
  { value: 'visit', label: 'Visit', icon: 'MapPin' },
] as const;

export const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-800' },
] as const;

export const SALES_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'partner', label: 'Partner' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
] as const;
