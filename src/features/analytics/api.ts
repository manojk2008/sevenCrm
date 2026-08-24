/**
 * Data layer for the Analytics feature: talks to the real NestJS backend
 * (/analytics/*) and maps its response onto src/types/analytics.ts.
 *
 * Analytics is READ-ONLY. Revenue, win-rate, and average-deal-size figures
 * are deliberately NOT fetched from this file — call
 * src/features/sales/api.ts's getSalesSummary()/getRevenueByPeriod()
 * directly for those (Phase 8 decision D6: no second implementation).
 * Lead-source and funnel data reuse src/features/dashboard/api.ts and
 * src/features/sales/api.ts respectively, for the same reason.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { AnalyticsSummary, UnavailableMetric } from "@/types/analytics";

interface BackendAnalyticsSummary {
  period: { from: string | null; to: string | null; basis: "ENQUIRY_CREATED_AT" };
  newEnquiries: number;
  unavailableMetrics: UnavailableMetric[];
}

/** A single, user-facing message for anything an Analytics call can throw. */
export function getAnalyticsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That analytics data could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

export interface AnalyticsSummaryParams {
  from?: string;
  to?: string;
}

export async function getAnalyticsSummary(
  params: AnalyticsSummaryParams = {},
): Promise<AnalyticsSummary> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const query = search.toString();
  const result = await apiFetch<BackendAnalyticsSummary>(
    `/analytics/summary${query ? `?${query}` : ""}`,
  );
  return {
    period: { from: result.period.from, to: result.period.to, basis: "enquiry-created-at" },
    newEnquiries: result.newEnquiries,
    unavailableMetrics: result.unavailableMetrics,
  };
}
