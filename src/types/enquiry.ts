import { type ID, type Priority, type Comment, type Attachment, type TimelineEvent } from "./common";

export type EnquiryStage =
  | "new"
  | "contacted"
  | "follow-up"
  | "quotation-sent"
  | "negotiation"
  | "won"
  | "lost";

export type EnquirySource =
  | "website"
  | "referral"
  | "cold-call"
  | "social-media"
  | "email"
  | "trade-show"
  | "advertisement"
  | "partner"
  | "other";

export interface Enquiry {
  id: ID;
  title: string;
  clientId: ID;
  clientName: string;
  clientCompany: string;
  stage: EnquiryStage;
  expectedRevenue: number;
  probability: number;
  priority: Priority;
  source: EnquirySource;
  assignedTo: ID;
  assignedToName: string;
  assignedToAvatar?: string;
  description?: string;
  notes?: string;
  products: string[];
  expectedCloseDate: string;
  lastActivityDate?: string;
  lostReason?: string;
  comments: Comment[];
  attachments: Attachment[];
  timeline: TimelineEvent[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type EnquiryFormData = Omit<
  Enquiry,
  "id" | "comments" | "attachments" | "timeline" | "createdAt" | "updatedAt" | "lastActivityDate"
>;

export interface EnquiryStageInfo {
  key: EnquiryStage;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export const ENQUIRY_STAGES: EnquiryStageInfo[] = [
  { key: "new", label: "New", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-800", borderColor: "border-slate-300 dark:border-slate-600", icon: "Sparkles" },
  { key: "contacted", label: "Contacted", color: "text-sky-700 dark:text-sky-300", bgColor: "bg-sky-100 dark:bg-sky-900/30", borderColor: "border-sky-300 dark:border-sky-700", icon: "PhoneCall" },
  { key: "follow-up", label: "Follow-up", color: "text-violet-700 dark:text-violet-300", bgColor: "bg-violet-100 dark:bg-violet-900/30", borderColor: "border-violet-300 dark:border-violet-700", icon: "Clock" },
  { key: "quotation-sent", label: "Quotation Sent", color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900/30", borderColor: "border-amber-300 dark:border-amber-700", icon: "FileText" },
  { key: "negotiation", label: "Negotiation", color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30", borderColor: "border-orange-300 dark:border-orange-700", icon: "MessageSquare" },
  { key: "won", label: "Won", color: "text-emerald-700 dark:text-emerald-300", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", borderColor: "border-emerald-300 dark:border-emerald-700", icon: "Trophy" },
  { key: "lost", label: "Lost", color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-900/30", borderColor: "border-red-300 dark:border-red-700", icon: "XCircle" },
];

export const ENQUIRY_SOURCES: { label: string; value: EnquirySource }[] = [
  { label: "Website", value: "website" },
  { label: "Referral", value: "referral" },
  { label: "Cold Call", value: "cold-call" },
  { label: "Social Media", value: "social-media" },
  { label: "Email Campaign", value: "email" },
  { label: "Trade Show", value: "trade-show" },
  { label: "Advertisement", value: "advertisement" },
  { label: "Partner", value: "partner" },
  { label: "Other", value: "other" },
];
