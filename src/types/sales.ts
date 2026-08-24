// Phase 7C: Sales is a read-only aggregation/reporting layer over the existing
// CRM data (Enquiry, Quotation, QuotationLineItem, Product, Client, User).
// There is no Deal / SalesOrder / SalesTransaction record anywhere in the
// system, so this file deliberately declares no such entity — the previous
// `Deal` / `SalesMetric` / `SalesTarget` types described a persistence model
// that has never existed and were referenced by nothing.
//
// Every shape below mirrors a `SafeX` interface in
// backend/src/sales/sales.service.ts, translated to this codebase's lowercase
// enum convention by src/features/sales/api.ts.
import type { EnquiryStage } from "./enquiry";
import type { QuotationStatus } from "./quotation";

/**
 * What a period filter is actually applied to.
 *
 * The database records no acceptance timestamp for a quotation, so every
 * period-scoped Sales figure is keyed on the date the quotation (or enquiry)
 * was *raised*. The backend returns this discriminator on every response so
 * the UI cannot mislabel a cohort metric as "revenue closed this month".
 */
export type SalesPeriodBasis = "quotation-created-at" | "enquiry-created-at";

export interface SalesPeriod {
  from: string | null;
  to: string | null;
  basis: SalesPeriodBasis;
}

/**
 * A metric the database genuinely cannot support, declared by the API rather
 * than hardcoded in the UI. Rendered as an explicit "unavailable" row with its
 * real reason — never as a zero (which would read as "none") and never as a
 * fabricated figure.
 */
export interface UnavailableMetric {
  key: string;
  label: string;
  reason: string;
}

export interface QuotationStatusBucket {
  status: QuotationStatus;
  count: number;
  /** subtotal − discountAmount for this status. */
  netValue: number;
  /** grandTotal (tax inclusive) for this status. */
  grossValue: number;
}

export interface EnquiryStageBucket {
  stage: EnquiryStage;
  count: number;
  /** Sum of the user-entered expectedRevenue forecast — not realized revenue. */
  expectedRevenue: number;
}

export interface SalesSummary {
  period: SalesPeriod;
  revenue: {
    /** Headline figure: Σ(subtotal − discountAmount) over ACCEPTED quotations. */
    netAcceptedRevenue: number;
    /** Σ(grandTotal) over ACCEPTED quotations — includes tax. */
    grossAcceptedValue: number;
    acceptedQuotationCount: number;
    averageAcceptedValue: number;
    /** Gross value of DRAFT + SENT quotations. Not revenue. */
    openPipelineValue: number;
    openQuotationCount: number;
  };
  quotationAcceptanceRate: {
    /** Percentage 0-100. Accepted ÷ decided; 0 when nothing is decided. */
    rate: number;
    accepted: number;
    /** ACCEPTED + REJECTED + EXPIRED. DRAFT/SENT are still open. */
    decided: number;
  };
  quotationStatusBreakdown: QuotationStatusBucket[];
  enquiryConversion: {
    won: number;
    lost: number;
    open: number;
    total: number;
    /** won ÷ (won + lost) as a percentage. */
    winRate: number;
    /** Forecast only. Never displayed alongside netAcceptedRevenue as revenue. */
    wonExpectedRevenue: number;
  };
  enquiryStageBreakdown: EnquiryStageBucket[];
  unavailableMetrics: UnavailableMetric[];
}

export interface RevenuePeriodBucket {
  /** First instant of the UTC month this bucket covers, ISO-8601. */
  periodStart: string;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface RevenueByPeriod {
  period: SalesPeriod;
  granularity: "month";
  buckets: RevenuePeriodBucket[];
}

export interface RevenueByClient {
  clientId: string;
  companyName: string;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface RevenueByRepresentative {
  /** Null for the "Unassigned" bucket — reported, never dropped. */
  userId: string | null;
  name: string;
  email: string | null;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  acceptedQuotationCount: number;
}

export interface RevenueByProduct {
  /** Null for ad-hoc/custom quotation lines. No product id is invented. */
  productId: string | null;
  productName: string;
  netAcceptedRevenue: number;
  grossAcceptedValue: number;
  quantity: number;
  lineItemCount: number;
}

export interface LostEnquiry {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  assignedTo: { id: string; name: string; email: string } | null;
  /** Free text exactly as the user wrote it — never bucketed into categories. */
  lostReason: string | null;
  expectedRevenue: number;
  createdAt: string;
}
