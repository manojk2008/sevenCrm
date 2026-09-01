/**
 * Data layer for the Enquiries feature: talks to the real NestJS backend
 * (/enquiries) and maps its response into the existing global `Enquiry`
 * shape (src/types/enquiry.ts) so no component needs to know the backend's
 * shape — mirrors src/features/clients/api.ts's pattern.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { Enquiry, EnquiryProduct, EnquirySource, EnquiryStage } from "@/types/enquiry";
import type { Priority } from "@/types/common";
import type { ProductStatus } from "@/types/product";

export type BackendEnquiryStage =
  | "NEW"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type BackendPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Mirrors SafeEnquirySource in backend/src/enquiry-sources/enquiry-sources.service.ts. */
export interface BackendEnquirySource {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors SafeEnquiryProduct in backend/src/enquiries/enquiries.service.ts. */
export interface BackendEnquiryProduct {
  id: string;
  productId: string;
  name: string;
  productGroup: { id: string; name: string };
  price: number;
  sku: string | null;
  unit: string | null;
  status: "ACTIVE" | "INACTIVE";
}

/** Mirrors SafeEnquiry in backend/src/enquiries/enquiries.service.ts. */
export interface BackendEnquiry {
  id: string;
  organizationId: string;
  title: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  stage: BackendEnquiryStage;
  expectedRevenue: number;
  probability: number;
  priority: BackendPriority;
  sourceId: string | null;
  sourceName: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  description: string | null;
  notes: string | null;
  expectedCloseDate: string;
  lostReason: string | null;
  tags: string[];
  products: BackendEnquiryProduct[];
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginatedEnquiries {
  data: BackendEnquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Enum translation. The backend uses Prisma's UPPER_SNAKE enums; the existing
// frontend type uses lower-hyphenated string unions. Both directions are
// exhaustive maps rather than string munging so a future enum value fails to
// compile instead of silently producing an invalid stage.
// ---------------------------------------------------------------------------

const STAGE_FROM_BACKEND: Record<BackendEnquiryStage, EnquiryStage> = {
  NEW: "new",
  CONTACTED: "contacted",
  FOLLOW_UP: "follow-up",
  QUOTATION_SENT: "quotation-sent",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
};

export const STAGE_TO_BACKEND: Record<EnquiryStage, BackendEnquiryStage> = {
  new: "NEW",
  contacted: "CONTACTED",
  "follow-up": "FOLLOW_UP",
  "quotation-sent": "QUOTATION_SENT",
  negotiation: "NEGOTIATION",
  won: "WON",
  lost: "LOST",
};

const PRIORITY_FROM_BACKEND: Record<BackendPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

/**
 * Product status uses the same lowercase convention as src/types/product.ts,
 * so an attached product's status can be compared against a `Product`
 * loaded through the Products API without a second translation.
 */
const PRODUCT_STATUS_FROM_BACKEND: Record<"ACTIVE" | "INACTIVE", ProductStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const PRIORITY_TO_BACKEND: Record<Priority, BackendPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
};

/**
 * Maps a backend enquiry product onto the frontend `EnquiryProduct` type.
 * Optional strings become "" rather than null, the same convention
 * `toProduct` in src/features/products/api.ts uses so values bind straight
 * to inputs.
 */
function toEnquiryProduct(product: BackendEnquiryProduct): EnquiryProduct {
  return {
    id: product.id,
    productId: product.productId,
    name: product.name,
    productGroup: product.productGroup,
    price: product.price,
    sku: product.sku ?? "",
    unit: product.unit ?? "",
    status: PRODUCT_STATUS_FROM_BACKEND[product.status],
  };
}

/** Maps a backend enquiry source onto the frontend `EnquirySource` type. */
function toEnquirySource(source: BackendEnquirySource): EnquirySource {
  return {
    id: source.id,
    name: source.name,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

/**
 * Maps a backend enquiry onto the existing global `Enquiry` type.
 *
 * `products` are the real attached Products resolved by the backend from the
 * EnquiryProduct join — never names, and never fabricated. `comments`,
 * `attachments` and `timeline` are still required by that type but have no
 * backend counterpart yet; they are filled with empty arrays purely to
 * satisfy it, and the UI must not present them as persisted data.
 * `lastActivityDate` is optional on the type and is left `undefined` rather
 * than being faked from `updatedAt`.
 */
export function toEnquiry(enquiry: BackendEnquiry): Enquiry {
  return {
    id: enquiry.id,
    title: enquiry.title,
    clientId: enquiry.clientId,
    clientName: enquiry.clientName,
    clientCompany: enquiry.clientCompany,
    stage: STAGE_FROM_BACKEND[enquiry.stage],
    expectedRevenue: enquiry.expectedRevenue,
    probability: enquiry.probability,
    priority: PRIORITY_FROM_BACKEND[enquiry.priority],
    sourceId: enquiry.sourceId,
    sourceName: enquiry.sourceName,
    // The global type models the assignee as a flat id + name pair; the
    // backend returns a nested object. Flattened here so the type stays
    // unchanged and no component has to know about the nesting.
    assignedTo: enquiry.assignedTo?.id ?? "",
    assignedToName: enquiry.assignedTo?.name ?? "",
    description: enquiry.description ?? undefined,
    notes: enquiry.notes ?? undefined,
    expectedCloseDate: enquiry.expectedCloseDate,
    lostReason: enquiry.lostReason ?? undefined,
    tags: enquiry.tags,
    products: enquiry.products.map(toEnquiryProduct),
    // Not backed by the API yet — see the doc comment above.
    comments: [],
    attachments: [],
    timeline: [],
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}

/** Enquiries-specific 404/409 wording; falls back to the shared helper otherwise. */
export function getEnquiryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That enquiry could not be found.";
    if (error.status === 409) return error.message || "This conflicts with an existing enquiry.";
  }
  return getFriendlyErrorMessage(error);
}

/** Enquiry-source-specific 409 wording (duplicate name); falls back otherwise. */
export function getEnquirySourceErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return error.message || "This source conflicts with an existing one.";
  }
  return getFriendlyErrorMessage(error);
}

export interface ListEnquiriesParams {
  search?: string;
  stage?: EnquiryStage;
  priority?: Priority;
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}

export interface EnquiryListResult {
  data: Enquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listEnquiries(params: ListEnquiriesParams = {}): Promise<EnquiryListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.stage) query.set("stage", STAGE_TO_BACKEND[params.stage]);
  if (params.priority) query.set("priority", PRIORITY_TO_BACKEND[params.priority]);
  if (params.assignedToId) query.set("assignedToId", params.assignedToId);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedEnquiries>(`/enquiries${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toEnquiry) };
}

export async function getEnquiry(id: string): Promise<Enquiry> {
  return toEnquiry(await apiFetch<BackendEnquiry>(`/enquiries/${id}`));
}

/** The values the existing EnquiryForm actually collects. */
export interface EnquiryFormValues {
  title: string;
  clientId: string;
  expectedRevenue: number;
  probability: number;
  priority: Priority;
  /** "" means no source selected — source is optional. */
  sourceId: string;
  expectedCloseDate: string;
  description?: string;
  assignedToId?: string;
  /**
   * The complete set of Product ids the enquiry should be attached to —
   * stable ids from the Products API, never product names. Always sent (even
   * when empty) so clearing the selection actually detaches everything.
   */
  productIds: string[];
}

interface CreateEnquiryBody {
  title: string;
  clientId: string;
  expectedRevenue: number;
  probability: number;
  priority: BackendPriority;
  sourceId?: string;
  expectedCloseDate: string;
  description?: string;
  assignedToId?: string;
  productIds: string[];
}

/**
 * `expectedCloseDate` comes from a native `<input type="date">` (a bare
 * `YYYY-MM-DD`), which `@IsDateString()` rejects — it requires a full ISO-8601
 * datetime. Normalised here rather than in the component.
 */
function toIsoDate(value: string): string {
  return value.includes("T") ? value : new Date(`${value}T00:00:00.000Z`).toISOString();
}

export async function createEnquiry(values: EnquiryFormValues): Promise<Enquiry> {
  const body: CreateEnquiryBody = {
    title: values.title,
    clientId: values.clientId,
    expectedRevenue: values.expectedRevenue,
    probability: values.probability,
    priority: PRIORITY_TO_BACKEND[values.priority],
    expectedCloseDate: toIsoDate(values.expectedCloseDate),
    productIds: values.productIds,
  };
  if (values.sourceId) body.sourceId = values.sourceId;
  if (values.description) body.description = values.description;
  if (values.assignedToId) body.assignedToId = values.assignedToId;

  return toEnquiry(
    await apiFetch<BackendEnquiry>("/enquiries", { method: "POST", body: JSON.stringify(body) }),
  );
}

/**
 * PATCH /enquiries/:id. Sends the selected `productIds` as the complete
 * replacement set. Deliberately omits `clientId` (the backend does not
 * allow client reassignment), `stage`/`lostReason` (those go through
 * updateEnquiryStage) and id/organizationId/timestamps (never client-settable).
 */
export async function updateEnquiry(id: string, values: EnquiryFormValues): Promise<Enquiry> {
  const body: Omit<CreateEnquiryBody, "clientId" | "sourceId"> & { sourceId: string | null } = {
    title: values.title,
    expectedRevenue: values.expectedRevenue,
    probability: values.probability,
    priority: PRIORITY_TO_BACKEND[values.priority],
    // Always sent (unlike description/assignedToId below): "" means the
    // user cleared it, and null is how the backend distinguishes "clear"
    // from "leave untouched" (see UpdateEnquiryDto.sourceId).
    sourceId: values.sourceId || null,
    expectedCloseDate: toIsoDate(values.expectedCloseDate),
    // Sent as the full replacement set: the backend attaches what is new,
    // detaches what is missing, and leaves everything else alone — which is
    // what keeps an already-attached inactive product from being dropped by
    // a save that still lists it.
    productIds: values.productIds,
  };
  if (values.description !== undefined) body.description = values.description;
  if (values.assignedToId !== undefined) body.assignedToId = values.assignedToId;

  return toEnquiry(
    await apiFetch<BackendEnquiry>(`/enquiries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * PATCH /enquiries/:id/stage. `lostReason` is required by the backend when
 * moving to `lost` and is rejected as blank — callers must collect it first
 * (see the LOST dialog in enquiries-content.tsx).
 */
export async function updateEnquiryStage(
  id: string,
  stage: EnquiryStage,
  lostReason?: string,
): Promise<Enquiry> {
  const body: { stage: BackendEnquiryStage; lostReason?: string } = {
    stage: STAGE_TO_BACKEND[stage],
  };
  if (stage === "lost" && lostReason) body.lostReason = lostReason;

  return toEnquiry(
    await apiFetch<BackendEnquiry>(`/enquiries/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Permanent removal — distinct from a stage change to lost/won, which
 * keeps the record. Safe with no conflict response to handle: the backend
 * cascades EnquiryProduct join rows and clears (never deletes) any linked
 * Quotation/Follow-up's enquiryId.
 */
export async function deleteEnquiry(id: string): Promise<void> {
  await apiFetch<{ id: string }>(`/enquiries/${id}`, { method: "DELETE" });
}

/**
 * GET /enquiry-sources — every source belonging to the caller's
 * organization, alphabetical. Populates the Enquiry form's Source dropdown;
 * there is no hardcoded list anywhere on the frontend to fall back to.
 */
export async function listEnquirySources(): Promise<EnquirySource[]> {
  const result = await apiFetch<BackendEnquirySource[]>("/enquiry-sources");
  return result.map(toEnquirySource);
}

/**
 * POST /enquiry-sources. `name` is trimmed server-side; the backend rejects
 * a blank/whitespace-only value and a case-insensitive duplicate within the
 * organization with a 409 (see getEnquirySourceErrorMessage).
 */
export async function createEnquirySource(name: string): Promise<EnquirySource> {
  return toEnquirySource(
    await apiFetch<BackendEnquirySource>("/enquiry-sources", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
}
