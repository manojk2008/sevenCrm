// Phase 8: Analytics is a read-only aggregation layer. Revenue, win-rate,
// and average-deal-size figures are NOT duplicated here — the frontend
// reads those directly from /sales/summary (see src/types/sales.ts).
// This file covers only the one genuinely new figure (newEnquiries) and the
// metrics the database honestly cannot support.
export interface UnavailableMetric {
  key: string;
  label: string;
  reason: string;
}

export interface AnalyticsSummary {
  period: { from: string | null; to: string | null; basis: "enquiry-created-at" };
  /** Enquiries raised in this period. */
  newEnquiries: number;
  unavailableMetrics: UnavailableMetric[];
}
