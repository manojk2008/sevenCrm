import { type ID, type Priority, type Comment, type Attachment, type TimelineEvent } from "./common";
import { type ProductGroupSummary, type ProductStatus } from "./product";

/**
 * A Product attached to an Enquiry, as returned by the backend's
 * SafeEnquiryProduct (backend/src/enquiries/enquiries.service.ts).
 *
 * The relationship is keyed on `productId` — a stable Product id — never on
 * the product's name. Every display field below is resolved live from the
 * Product record on each read, so a renamed or repriced product is always
 * shown with its current values. `status` is carried so an attached product
 * that has since been deactivated can be marked as such rather than hidden.
 *
 * Reuses ProductGroupSummary/ProductStatus from ./product rather than
 * redeclaring the product shape here.
 */
export interface EnquiryProduct {
  /** Id of the Enquiry-Product relationship row itself. */
  id: ID;
  /** The attached Product's id — the source of truth for the relationship. */
  productId: ID;
  name: string;
  productGroup: ProductGroupSummary;
  price: number;
  sku: string;
  unit: string;
  status: ProductStatus;
}

export type EnquiryStage =
  | "new"
  | "contacted"
  | "follow-up"
  | "quotation-sent"
  | "negotiation"
  | "won"
  | "lost";

/**
 * An organization-scoped, user-created lead source — replaces the old fixed
 * EnquirySource enum. Mirrors SafeEnquirySource in
 * backend/src/enquiry-sources/enquiry-sources.service.ts. There is
 * deliberately no fixed list of these anywhere in the frontend; every
 * available value comes from GET /enquiry-sources (see
 * src/features/enquiries/api.ts's listEnquirySources).
 */
export interface EnquirySource {
  id: ID;
  name: string;
  createdAt: string;
  updatedAt: string;
}

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
  /** Optional organization-scoped lead source — see EnquirySourceSummary. */
  sourceId: ID | null;
  sourceName: string | null;
  assignedTo: ID;
  assignedToName: string;
  assignedToAvatar?: string;
  description?: string;
  notes?: string;
  products: EnquiryProduct[];
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
