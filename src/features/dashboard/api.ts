/**
 * Data layer for the Dashboard feature: talks to the real NestJS backend
 * (/dashboard/*) and maps its responses onto the canonical shapes in
 * src/types/dashboard.ts — mirrors src/features/sales/api.ts's pattern.
 *
 * Dashboard is READ-ONLY. Revenue, acceptance-rate, enquiry-conversion, and
 * enquiry-stage-breakdown figures are deliberately NOT fetched from this
 * file — those come straight from src/features/sales/api.ts, which already
 * owns those definitions (Phase 8 decision D6: no second implementation).
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type {
  Activity,
  ActivityType,
  DashboardLeadSources,
  DashboardSummary,
  LeadSourceBucket,
  MonthlyComparison,
  PeriodCounts,
  RecentActivity,
} from "@/types/dashboard";

type BackendActivityType =
  | "CLIENT_CREATED"
  | "ENQUIRY_CREATED"
  | "QUOTATION_CREATED"
  | "FOLLOW_UP_COMPLETED";

const ACTIVITY_TYPE_FROM_BACKEND: Record<BackendActivityType, ActivityType> = {
  CLIENT_CREATED: "client-created",
  ENQUIRY_CREATED: "enquiry-created",
  QUOTATION_CREATED: "quotation-created",
  FOLLOW_UP_COMPLETED: "follow-up-completed",
};

interface BackendLeadSourceBucket {
  id: string | null;
  name: string;
  count: number;
}

interface BackendDashboardLeadSources {
  period: { from: string | null; to: string | null; basis: "ENQUIRY_CREATED_AT" };
  sources: BackendLeadSourceBucket[];
  totalLeads: number;
}

interface BackendActivity {
  id: string;
  type: BackendActivityType;
  occurredAt: string;
  clientId?: string;
  companyName?: string;
  enquiryId?: string;
  title?: string;
  clientName?: string;
  quotationId?: string;
  quotationNumber?: string;
  followUpId?: string;
  subject?: string;
}

interface BackendRecentActivity {
  activities: BackendActivity[];
}

interface BackendPeriodCounts {
  from: string;
  to: string;
  leads: number;
  meetings: number;
  quotes: number;
  wins: number;
}

interface BackendMonthlyComparison {
  current: BackendPeriodCounts;
  previous: BackendPeriodCounts;
}

/** A single, user-facing message for anything a Dashboard call can throw. */
export function getDashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That dashboard data could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

function toLeadSourceBucket(bucket: BackendLeadSourceBucket): LeadSourceBucket {
  return { id: bucket.id, name: bucket.name, count: bucket.count };
}

/**
 * The backend returns a discriminated union keyed on `type` with the fields
 * that type needs; this reassembles it into the frontend's Activity union
 * with the lowercase type tag, one exhaustive switch so an unhandled
 * backend activity type fails to compile.
 */
function toActivity(raw: BackendActivity): Activity {
  const type = ACTIVITY_TYPE_FROM_BACKEND[raw.type];
  switch (type) {
    case "client-created":
      return {
        id: raw.id,
        type,
        occurredAt: raw.occurredAt,
        clientId: raw.clientId!,
        companyName: raw.companyName!,
      };
    case "enquiry-created":
      return {
        id: raw.id,
        type,
        occurredAt: raw.occurredAt,
        enquiryId: raw.enquiryId!,
        title: raw.title!,
        clientName: raw.clientName!,
      };
    case "quotation-created":
      return {
        id: raw.id,
        type,
        occurredAt: raw.occurredAt,
        quotationId: raw.quotationId!,
        quotationNumber: raw.quotationNumber!,
        clientName: raw.clientName!,
      };
    case "follow-up-completed":
      return {
        id: raw.id,
        type,
        occurredAt: raw.occurredAt,
        followUpId: raw.followUpId!,
        subject: raw.subject!,
        clientName: raw.clientName!,
      };
  }
}

function toPeriodCounts(raw: BackendPeriodCounts): PeriodCounts {
  return raw;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}

export interface LeadSourcesParams {
  from?: string;
  to?: string;
}

export async function getLeadSources(
  params: LeadSourcesParams = {},
): Promise<DashboardLeadSources> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const query = search.toString();
  const result = await apiFetch<BackendDashboardLeadSources>(
    `/dashboard/lead-sources${query ? `?${query}` : ""}`,
  );
  return {
    period: { from: result.period.from, to: result.period.to, basis: "enquiry-created-at" },
    sources: result.sources.map(toLeadSourceBucket),
    totalLeads: result.totalLeads,
  };
}

export async function getRecentActivity(limit?: number): Promise<RecentActivity> {
  const result = await apiFetch<BackendRecentActivity>(
    `/dashboard/recent-activity${limit ? `?limit=${limit}` : ""}`,
  );
  return { activities: result.activities.map(toActivity) };
}

export async function getMonthlyComparison(): Promise<MonthlyComparison> {
  const result = await apiFetch<BackendMonthlyComparison>("/dashboard/monthly-comparison");
  return { current: toPeriodCounts(result.current), previous: toPeriodCounts(result.previous) };
}
