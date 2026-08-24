/**
 * Data layer for the Sales feature: talks to the real NestJS backend
 * (/sales/*) and maps its responses onto the canonical shapes in
 * src/types/sales.ts — mirrors src/features/follow-ups/api.ts's pattern.
 *
 * Sales is READ-ONLY. There are no create/update/delete functions here
 * because the backend exposes no write route: every figure is derived from
 * records the Enquiries / Quotations / Products modules own.
 *
 * Revenue definitions (fixed backend-side, restated here so a caller reading
 * only this file is not misled):
 *   Net Accepted Revenue = Σ(subtotal − discountAmount) over ACCEPTED quotations
 *   Gross Accepted Value = Σ(grandTotal)                over ACCEPTED quotations
 * DRAFT and SENT quotations are never revenue; they are reported separately as
 * open pipeline.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { EnquiryStage } from "@/types/enquiry";
import type { QuotationStatus } from "@/types/quotation";
import type {
  EnquiryStageBucket,
  LostEnquiry,
  QuotationStatusBucket,
  RevenueByClient,
  RevenueByPeriod,
  RevenueByProduct,
  RevenueByRepresentative,
  SalesPeriod,
  SalesPeriodBasis,
  SalesSummary,
  UnavailableMetric,
} from "@/types/sales";

type BackendQuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

type BackendEnquiryStage =
  | "NEW"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

type BackendPeriodBasis = "QUOTATION_CREATED_AT" | "ENQUIRY_CREATED_AT";

interface BackendSalesPeriod {
  from: string | null;
  to: string | null;
  basis: BackendPeriodBasis;
}

interface BackendQuotationStatusBucket {
  status: BackendQuotationStatus;
  count: number;
  netValue: number;
  grossValue: number;
}

interface BackendEnquiryStageBucket {
  stage: BackendEnquiryStage;
  count: number;
  expectedRevenue: number;
}

/** Mirrors SafeSalesSummary in backend/src/sales/sales.service.ts. */
interface BackendSalesSummary {
  period: BackendSalesPeriod;
  revenue: {
    netAcceptedRevenue: number;
    grossAcceptedValue: number;
    acceptedQuotationCount: number;
    averageAcceptedValue: number;
    openPipelineValue: number;
    openQuotationCount: number;
  };
  quotationAcceptanceRate: { rate: number; accepted: number; decided: number };
  quotationStatusBreakdown: BackendQuotationStatusBucket[];
  enquiryConversion: {
    won: number;
    lost: number;
    open: number;
    total: number;
    winRate: number;
    wonExpectedRevenue: number;
  };
  enquiryStageBreakdown: BackendEnquiryStageBucket[];
  unavailableMetrics: UnavailableMetric[];
}

interface BackendRevenueByPeriod {
  period: BackendSalesPeriod;
  granularity: "MONTH";
  buckets: {
    periodStart: string;
    netAcceptedRevenue: number;
    grossAcceptedValue: number;
    acceptedQuotationCount: number;
  }[];
}

interface BackendLostEnquiries {
  data: LostEnquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Enum translation. The backend uses Prisma's UPPER_SNAKE enums; the canonical
// frontend types use lowercase string unions. Both directions are exhaustive
// `Record` maps rather than `toLowerCase()` string munging, so a future enum
// value fails to compile instead of silently producing an invalid status —
// nothing is ever cast blindly. Same rule as every other feature's api.ts.
// ---------------------------------------------------------------------------

const QUOTATION_STATUS_FROM_BACKEND: Record<BackendQuotationStatus, QuotationStatus> = {
  DRAFT: "draft",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

const ENQUIRY_STAGE_FROM_BACKEND: Record<BackendEnquiryStage, EnquiryStage> = {
  NEW: "new",
  CONTACTED: "contacted",
  FOLLOW_UP: "follow-up",
  QUOTATION_SENT: "quotation-sent",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
};

const PERIOD_BASIS_FROM_BACKEND: Record<BackendPeriodBasis, SalesPeriodBasis> = {
  QUOTATION_CREATED_AT: "quotation-created-at",
  ENQUIRY_CREATED_AT: "enquiry-created-at",
};

function toPeriod(period: BackendSalesPeriod): SalesPeriod {
  return {
    from: period.from,
    to: period.to,
    basis: PERIOD_BASIS_FROM_BACKEND[period.basis],
  };
}

function toStatusBucket(bucket: BackendQuotationStatusBucket): QuotationStatusBucket {
  return {
    status: QUOTATION_STATUS_FROM_BACKEND[bucket.status],
    count: bucket.count,
    netValue: bucket.netValue,
    grossValue: bucket.grossValue,
  };
}

function toStageBucket(bucket: BackendEnquiryStageBucket): EnquiryStageBucket {
  return {
    stage: ENQUIRY_STAGE_FROM_BACKEND[bucket.stage],
    count: bucket.count,
    expectedRevenue: bucket.expectedRevenue,
  };
}

/** A single, user-facing message for anything a Sales call can throw. */
export function getSalesErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That sales data could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface SalesPeriodParams {
  /** Inclusive ISO-8601 lower bound on the quotation's *raised* date. */
  from?: string;
  /** Inclusive ISO-8601 upper bound on the quotation's *raised* date. */
  to?: string;
}

export interface RevenueBreakdownParams extends SalesPeriodParams {
  /** Top-N cap, 1-100. Defaults to 10 server-side. */
  limit?: number;
}

export interface ListLostEnquiriesParams extends SalesPeriodParams {
  page?: number;
  pageSize?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSalesSummary(params: SalesPeriodParams = {}): Promise<SalesSummary> {
  const summary = await apiFetch<BackendSalesSummary>(
    `/sales/summary${buildQuery({ from: params.from, to: params.to })}`,
  );
  return {
    period: toPeriod(summary.period),
    revenue: summary.revenue,
    quotationAcceptanceRate: summary.quotationAcceptanceRate,
    quotationStatusBreakdown: summary.quotationStatusBreakdown.map(toStatusBucket),
    enquiryConversion: summary.enquiryConversion,
    enquiryStageBreakdown: summary.enquiryStageBreakdown.map(toStageBucket),
    unavailableMetrics: summary.unavailableMetrics,
  };
}

export async function getRevenueByPeriod(
  params: SalesPeriodParams = {},
): Promise<RevenueByPeriod> {
  const result = await apiFetch<BackendRevenueByPeriod>(
    `/sales/revenue-by-period${buildQuery({ from: params.from, to: params.to })}`,
  );
  return {
    period: toPeriod(result.period),
    granularity: "month",
    buckets: result.buckets,
  };
}

export function getRevenueByClient(
  params: RevenueBreakdownParams = {},
): Promise<RevenueByClient[]> {
  return apiFetch<RevenueByClient[]>(
    `/sales/revenue-by-client${buildQuery({ from: params.from, to: params.to, limit: params.limit })}`,
  );
}

export function getRevenueByProduct(
  params: RevenueBreakdownParams = {},
): Promise<RevenueByProduct[]> {
  return apiFetch<RevenueByProduct[]>(
    `/sales/revenue-by-product${buildQuery({ from: params.from, to: params.to, limit: params.limit })}`,
  );
}

export function getRevenueByRepresentative(
  params: RevenueBreakdownParams = {},
): Promise<RevenueByRepresentative[]> {
  return apiFetch<RevenueByRepresentative[]>(
    `/sales/revenue-by-representative${buildQuery({ from: params.from, to: params.to, limit: params.limit })}`,
  );
}

export interface LostEnquiryListResult {
  data: LostEnquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getLostEnquiries(
  params: ListLostEnquiriesParams = {},
): Promise<LostEnquiryListResult> {
  return apiFetch<BackendLostEnquiries>(
    `/sales/lost-enquiries${buildQuery({
      from: params.from,
      to: params.to,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  );
}
