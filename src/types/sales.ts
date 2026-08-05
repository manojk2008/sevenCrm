export interface Deal {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  enquiryId?: string;
  value: number;
  closedDate: string | Date;
  type: 'won' | 'lost';
  lostReason?: string;
  executive: string;
  executiveName: string;
  duration: number; // days
}

export interface SalesMetric {
  label: string;
  value: number | string;
  previousValue: number | string;
  change: number; // percentage
}

export interface SalesTarget {
  executive: string;
  target: number;
  achieved: number;
  percentage: number;
}
