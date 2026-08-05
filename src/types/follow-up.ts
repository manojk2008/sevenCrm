export type FollowUpType = 'call' | 'email' | 'meeting' | 'demo' | 'visit';

export type FollowUpStatus = 'scheduled' | 'completed' | 'cancelled' | 'overdue';

export interface FollowUp {
  id: string;
  clientId: string;
  clientName: string;
  enquiryId?: string;
  subject: string;
  description?: string;
  type: FollowUpType;
  priority: 'low' | 'medium' | 'high';
  status: FollowUpStatus;
  scheduledAt: string | Date;
  completedAt?: string | Date;
  assignedTo: string;
  assignedToName: string;
  reminder?: boolean;
  notes?: string;
  outcome?: string;
}
