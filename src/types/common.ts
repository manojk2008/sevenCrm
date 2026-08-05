// ============================================================
// SevenCRM — Common Type Definitions
// ============================================================

export type ID = string;

export type Status = "active" | "inactive" | "archived";

export type Priority = "low" | "medium" | "high" | "urgent";

export type SortDirection = "asc" | "desc";

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SelectOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TimelineEvent {
  id: ID;
  type: "call" | "email" | "meeting" | "note" | "deal" | "quotation" | "system";
  title: string;
  description: string;
  timestamp: string;
  user: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string>;
}

export interface Attachment {
  id: ID;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Comment {
  id: ID;
  content: string;
  author: {
    id: ID;
    name: string;
    avatar?: string;
    role: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface KPIMetric {
  label: string;
  value: number;
  previousValue?: number;
  format: "currency" | "number" | "percentage";
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}

export type ViewMode = "table" | "grid" | "kanban";

export type ThemeMode = "light" | "dark" | "system";
