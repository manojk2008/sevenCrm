export type NotificationType = 'enquiry' | 'follow-up' | 'quotation' | 'deal' | 'system' | 'task';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  href?: string;
  createdAt: string | Date;
  actor?: {
    name: string;
    avatar?: string;
  };
}
