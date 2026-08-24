// Phase 8: Dashboard is a read-only aggregation layer over Client / Enquiry /
// Quotation / Product / FollowUp. Revenue, acceptance-rate, enquiry-
// conversion, and enquiry-stage-breakdown figures are NOT duplicated here —
// those are owned by Sales (see src/types/sales.ts) and fetched from
// /sales/* directly. This file only covers the handful of figures Sales has
// no reason to compute: entity counts, lead sources, cross-entity recent
// activity, and period-over-period counts of leads/meetings/quotes/wins.
import type { EnquirySource } from "./enquiry";

export interface DashboardSummary {
  /** Every Client row in the organization, regardless of status. */
  totalClients: number;
  /** Every Product row in the organization, regardless of status. */
  totalProducts: number;
  /** Enquiry.stage not in (won, lost) — a snapshot as of now. */
  openEnquiries: number;
}

export interface LeadSourceBucket {
  source: EnquirySource;
  count: number;
}

export interface DashboardLeadSources {
  period: { from: string | null; to: string | null; basis: "enquiry-created-at" };
  sources: LeadSourceBucket[];
  totalLeads: number;
}

export type ActivityType =
  | "client-created"
  | "enquiry-created"
  | "quotation-created"
  | "follow-up-completed";

interface BaseActivity {
  id: string;
  occurredAt: string;
}

export interface ClientCreatedActivity extends BaseActivity {
  type: "client-created";
  clientId: string;
  companyName: string;
}

export interface EnquiryCreatedActivity extends BaseActivity {
  type: "enquiry-created";
  enquiryId: string;
  title: string;
  clientName: string;
}

export interface QuotationCreatedActivity extends BaseActivity {
  type: "quotation-created";
  quotationId: string;
  quotationNumber: string;
  clientName: string;
}

export interface FollowUpCompletedActivity extends BaseActivity {
  type: "follow-up-completed";
  followUpId: string;
  subject: string;
  clientName: string;
}

/**
 * Every activity type this feed can honestly represent. Nothing else is
 * synthesized: no "stage change", "quotation sent", or "deal won" event
 * exists here because none of those has a real, persisted timestamp
 * anywhere in the schema (see the Phase 8 inspection report, D3).
 */
export type Activity =
  | ClientCreatedActivity
  | EnquiryCreatedActivity
  | QuotationCreatedActivity
  | FollowUpCompletedActivity;

export interface RecentActivity {
  activities: Activity[];
}

export interface PeriodCounts {
  from: string;
  to: string;
  /** New enquiries raised in this window. */
  leads: number;
  /** Follow-ups of type "meeting" created in this window. */
  meetings: number;
  /** Quotations raised in this window. */
  quotes: number;
  /**
   * Enquiries currently at stage "won" that were *raised* in this window —
   * a raised-date cohort, not "enquiries won in this window" (the schema
   * records no won-at timestamp).
   */
  wins: number;
}

export interface MonthlyComparison {
  current: PeriodCounts;
  previous: PeriodCounts;
}
