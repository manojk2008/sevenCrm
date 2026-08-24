/**
 * Data layer for the Quotations feature: talks to the real NestJS backend
 * (/quotations) and maps its response into the existing global `Quotation`
 * shape (src/types/quotation.ts) so no component needs to know the
 * backend's shape — mirrors src/features/clients/api.ts's pattern.
 *
 * Historical-snapshot guarantee (Phase 6B/6C): `productName`/`unitPrice` on
 * a line item are values captured by the backend at the time that line was
 * created or last explicitly replaced (see QuotationsService.
 * resolveLineItemsForUpdate) — they are never re-derived from the current
 * Product catalog on read. This module simply carries whatever the backend
 * returns straight through; it never re-fetches or overwrites a line's
 * snapshot from src/features/products/api.ts.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { Quotation, QuotationLineItem, QuotationStatus } from "@/types/quotation";

export type BackendQuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

/** Mirrors SafeQuotationLineItem in backend/src/quotations/quotations.service.ts. */
export interface BackendQuotationLineItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  description: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  discountPercentage: number;
  taxRate: number;
  lineAmount: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors SafeQuotation in backend/src/quotations/quotations.service.ts. */
export interface BackendQuotation {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  enquiryId: string | null;
  enquiryTitle: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  quotationNumber: string;
  status: BackendQuotationStatus;
  validUntil: string;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  lineItems: BackendQuotationLineItem[];
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginatedQuotations {
  data: BackendQuotation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_FROM_BACKEND: Record<BackendQuotationStatus, QuotationStatus> = {
  DRAFT: "draft",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

export const STATUS_TO_BACKEND: Record<QuotationStatus, BackendQuotationStatus> = {
  draft: "DRAFT",
  sent: "SENT",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  expired: "EXPIRED",
};

function toLineItem(line: BackendQuotationLineItem): QuotationLineItem {
  return {
    id: line.id,
    productId: line.productId,
    productName: line.productNameSnapshot,
    description: line.description ?? undefined,
    quantity: line.quantity,
    unitPrice: line.unitPriceSnapshot,
    discountPercentage: line.discountPercentage,
    taxRate: line.taxRate,
    amount: line.lineAmount,
  };
}

export function toQuotation(quotation: BackendQuotation): Quotation {
  return {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    clientId: quotation.clientId,
    clientName: quotation.clientName,
    enquiryId: quotation.enquiryId,
    enquiryTitle: quotation.enquiryTitle,
    assignedTo: quotation.assignedTo,
    lineItems: quotation.lineItems.map(toLineItem),
    subtotal: quotation.subtotal,
    discountAmount: quotation.discountAmount,
    taxAmount: quotation.taxAmount,
    grandTotal: quotation.grandTotal,
    validUntil: quotation.validUntil,
    notes: quotation.notes ?? undefined,
    terms: quotation.terms ?? undefined,
    status: STATUS_FROM_BACKEND[quotation.status],
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
  };
}

/** Quotations-specific 404 wording; falls back to the shared helper otherwise. */
export function getQuotationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return "That quotation could not be found.";
  return getFriendlyErrorMessage(error);
}

export interface ListQuotationsParams {
  search?: string;
  status?: QuotationStatus | "all";
  clientId?: string;
  enquiryId?: string;
  page?: number;
  pageSize?: number;
}

export interface QuotationListResult {
  data: Quotation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listQuotations(params: ListQuotationsParams = {}): Promise<QuotationListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", STATUS_TO_BACKEND[params.status]);
  if (params.clientId) query.set("clientId", params.clientId);
  if (params.enquiryId) query.set("enquiryId", params.enquiryId);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedQuotations>(`/quotations${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toQuotation) };
}

export async function getQuotation(id: string): Promise<Quotation> {
  return toQuotation(await apiFetch<BackendQuotation>(`/quotations/${id}`));
}

/**
 * One line item as the builder collects it. `id` is present only for a line
 * that already exists on the quotation being edited — passing it back
 * unchanged (with the same productId) is what lets the backend preserve
 * that line's historical snapshot instead of re-resolving it from the
 * current Product (see QuotationsService.resolveLineItemsForUpdate). A
 * brand-new line (added in this editing session) has no `id`.
 *
 * Exactly one of two shapes is valid, matching CreateQuotationLineItemDto:
 *   - CATALOG: productId set. productName/unitPrice are not sent — the
 *     backend always snapshots the live Product's current name/price for a
 *     line whose productId actually changed or is new.
 *   - AD-HOC: productId omitted. productName/unitPrice are required and are
 *     used as the snapshot verbatim.
 */
export interface QuotationLineItemInput {
  id?: string;
  productId?: string;
  productName?: string;
  unitPrice?: number;
  description?: string;
  quantity: number;
  discountPercentage?: number;
  taxRate?: number;
}

interface QuotationLineItemBody {
  id?: string;
  productId?: string;
  productName?: string;
  unitPrice?: number;
  description?: string;
  quantity: number;
  discountPercentage?: number;
  taxRate?: number;
}

function toLineItemBody(line: QuotationLineItemInput): QuotationLineItemBody {
  const body: QuotationLineItemBody = { quantity: line.quantity };
  if (line.id) body.id = line.id;
  if (line.productId) {
    body.productId = line.productId;
  } else {
    body.productName = line.productName;
    body.unitPrice = line.unitPrice;
  }
  if (line.description) body.description = line.description;
  if (line.discountPercentage !== undefined) body.discountPercentage = line.discountPercentage;
  if (line.taxRate !== undefined) body.taxRate = line.taxRate;
  return body;
}

/** The values the quotation builder collects for creation. */
export interface CreateQuotationValues {
  clientId: string;
  enquiryId?: string;
  assignedToId?: string;
  validUntil: string;
  notes?: string;
  terms?: string;
  lineItems: QuotationLineItemInput[];
}

/**
 * `validUntil` comes from a native `<input type="date">` (a bare
 * `YYYY-MM-DD`), which `@IsDateString()` rejects — it requires a full
 * ISO-8601 datetime. Normalised here rather than in the component, same
 * fix src/features/enquiries/api.ts applies to expectedCloseDate.
 */
function toIsoDate(value: string): string {
  return value.includes("T") ? value : new Date(`${value}T00:00:00.000Z`).toISOString();
}

export async function createQuotation(values: CreateQuotationValues): Promise<Quotation> {
  const body = {
    clientId: values.clientId,
    ...(values.enquiryId ? { enquiryId: values.enquiryId } : {}),
    ...(values.assignedToId ? { assignedToId: values.assignedToId } : {}),
    validUntil: toIsoDate(values.validUntil),
    ...(values.notes ? { notes: values.notes } : {}),
    ...(values.terms ? { terms: values.terms } : {}),
    lineItems: values.lineItems.map(toLineItemBody),
  };
  return toQuotation(await apiFetch<BackendQuotation>("/quotations", { method: "POST", body: JSON.stringify(body) }));
}

/** The values the quotation builder collects for an edit. */
export interface UpdateQuotationValues {
  enquiryId?: string | null;
  assignedToId?: string | null;
  validUntil?: string;
  notes?: string;
  terms?: string;
  lineItems?: QuotationLineItemInput[];
}

/**
 * PATCH /quotations/:id. Deliberately omits clientId — the backend does not
 * allow re-parenting a quotation to a different client (same reasoning
 * updateEnquiry omits clientId). `lineItems`, when supplied, is sent as the
 * complete replacement set (see QuotationLineItemInput's doc comment for
 * how existing lines keep their snapshot).
 */
export async function updateQuotation(id: string, values: UpdateQuotationValues): Promise<Quotation> {
  const body: Record<string, unknown> = {};
  if (values.enquiryId !== undefined) body.enquiryId = values.enquiryId;
  if (values.assignedToId !== undefined) body.assignedToId = values.assignedToId;
  if (values.validUntil !== undefined) body.validUntil = toIsoDate(values.validUntil);
  if (values.notes !== undefined) body.notes = values.notes;
  if (values.terms !== undefined) body.terms = values.terms;
  if (values.lineItems !== undefined) body.lineItems = values.lineItems.map(toLineItemBody);

  return toQuotation(
    await apiFetch<BackendQuotation>(`/quotations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<Quotation> {
  return toQuotation(
    await apiFetch<BackendQuotation>(`/quotations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: STATUS_TO_BACKEND[status] }),
    }),
  );
}
