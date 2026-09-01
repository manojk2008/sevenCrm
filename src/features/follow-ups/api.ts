/**
 * Data layer for the Follow-ups feature: talks to the real NestJS backend
 * (/follow-ups) and maps its response onto the canonical `FollowUp` shape
 * (src/types/follow-up.ts) so no component needs to know the backend's
 * enum casing — mirrors src/features/enquiries/api.ts's pattern.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type {
  FollowUp,
  FollowUpStatus,
  FollowUpType,
  FollowUpClientRef,
  FollowUpEnquiryRef,
  FollowUpUserRef,
} from "@/types/follow-up";
import type { Priority } from "@/types/common";

export type BackendFollowUpType = "CALL" | "EMAIL" | "MEETING" | "DEMO" | "VISIT";

/** Three values only — the backend has no OVERDUE status. See `isOverdue`. */
export type BackendFollowUpStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type BackendPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Mirrors SafeFollowUp in backend/src/follow-ups/follow-ups.service.ts. */
export interface BackendFollowUp {
  id: string;
  organizationId: string;
  clientId: string;
  client: FollowUpClientRef;
  enquiryId: string | null;
  enquiry: FollowUpEnquiryRef | null;
  assignedToId: string | null;
  assignedTo: FollowUpUserRef | null;
  subject: string;
  description: string | null;
  type: BackendFollowUpType;
  priority: BackendPriority;
  status: BackendFollowUpStatus;
  scheduledAt: string;
  completedAt: string | null;
  outcome: string | null;
  notes: string | null;
  reminder: boolean;
  isAutoManaged: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginatedFollowUps {
  data: BackendFollowUp[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Enum translation. The backend uses Prisma's UPPER_SNAKE enums; the canonical
// frontend type uses lowercase string unions. Both directions are exhaustive
// `Record` maps rather than `toLowerCase()`/`toUpperCase()` string munging, so
// a future enum value fails to compile instead of silently producing an
// invalid status — nothing is ever cast blindly.
// ---------------------------------------------------------------------------

const TYPE_FROM_BACKEND: Record<BackendFollowUpType, FollowUpType> = {
  CALL: "call",
  EMAIL: "email",
  MEETING: "meeting",
  DEMO: "demo",
  VISIT: "visit",
};

export const TYPE_TO_BACKEND: Record<FollowUpType, BackendFollowUpType> = {
  call: "CALL",
  email: "EMAIL",
  meeting: "MEETING",
  demo: "DEMO",
  visit: "VISIT",
};

const STATUS_FROM_BACKEND: Record<BackendFollowUpStatus, FollowUpStatus> = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const STATUS_TO_BACKEND: Record<FollowUpStatus, BackendFollowUpStatus> = {
  scheduled: "SCHEDULED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

const PRIORITY_FROM_BACKEND: Record<BackendPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const PRIORITY_TO_BACKEND: Record<Priority, BackendPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
};

/**
 * Maps a backend follow-up onto the canonical `FollowUp` type.
 *
 * `isOverdue` is taken from the backend rather than recomputed here: the
 * server derives it from the same clock it filters `overdue=true` with, so a
 * filtered list and the badge on each of its rows can never disagree.
 * Nullable strings stay `null` (they are genuinely absent, not empty) — the
 * form layer is what converts them to "" for inputs.
 */
export function toFollowUp(followUp: BackendFollowUp): FollowUp {
  return {
    id: followUp.id,
    organizationId: followUp.organizationId,
    clientId: followUp.clientId,
    client: followUp.client,
    enquiryId: followUp.enquiryId,
    enquiry: followUp.enquiry,
    assignedToId: followUp.assignedToId,
    assignedTo: followUp.assignedTo,
    subject: followUp.subject,
    description: followUp.description,
    type: TYPE_FROM_BACKEND[followUp.type],
    priority: PRIORITY_FROM_BACKEND[followUp.priority],
    status: STATUS_FROM_BACKEND[followUp.status],
    scheduledAt: followUp.scheduledAt,
    completedAt: followUp.completedAt,
    outcome: followUp.outcome,
    notes: followUp.notes,
    reminder: followUp.reminder,
    isAutoManaged: followUp.isAutoManaged,
    isOverdue: followUp.isOverdue,
    createdAt: followUp.createdAt,
    updatedAt: followUp.updatedAt,
  };
}

/** Follow-up-specific 404/409 wording; falls back to the shared helper otherwise. */
export function getFollowUpErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That follow-up could not be found.";
    if (error.status === 409) return error.message || "This conflicts with an existing follow-up.";
  }
  return getFriendlyErrorMessage(error);
}

export interface ListFollowUpsParams {
  search?: string;
  status?: FollowUpStatus | "all";
  priority?: Priority | "all";
  type?: FollowUpType | "all";
  clientId?: string;
  enquiryId?: string;
  assignedToId?: string;
  /** Server-side filter on isAutoManaged — see FollowUp.isAutoManaged. */
  isAutoManaged?: boolean;
  /** Full ISO-8601 timestamps — inclusive bounds on scheduledAt. */
  scheduledFrom?: string;
  scheduledTo?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FollowUpListResult {
  data: FollowUp[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * GET /follow-ups. Every filter is sent to the server — nothing is fetched
 * wholesale and narrowed in React, so the list, the calendar and the
 * pagination footer all agree with `total`.
 */
export async function listFollowUps(
  params: ListFollowUpsParams = {},
): Promise<FollowUpListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") {
    query.set("status", STATUS_TO_BACKEND[params.status]);
  }
  if (params.priority && params.priority !== "all") {
    query.set("priority", PRIORITY_TO_BACKEND[params.priority]);
  }
  if (params.type && params.type !== "all") query.set("type", TYPE_TO_BACKEND[params.type]);
  if (params.clientId) query.set("clientId", params.clientId);
  if (params.enquiryId) query.set("enquiryId", params.enquiryId);
  if (params.assignedToId) query.set("assignedToId", params.assignedToId);
  if (params.isAutoManaged !== undefined) query.set("isAutoManaged", String(params.isAutoManaged));
  if (params.scheduledFrom) query.set("scheduledFrom", params.scheduledFrom);
  if (params.scheduledTo) query.set("scheduledTo", params.scheduledTo);
  if (params.overdue !== undefined) query.set("overdue", String(params.overdue));
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedFollowUps>(`/follow-ups${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toFollowUp) };
}

export async function getFollowUp(id: string): Promise<FollowUp> {
  return toFollowUp(await apiFetch<BackendFollowUp>(`/follow-ups/${id}`));
}

/** The values the Follow-up form actually collects. */
export interface FollowUpFormValues {
  clientId: string;
  /** "" means no enquiry linked. */
  enquiryId: string;
  /** "" means unassigned. */
  assignedToId: string;
  subject: string;
  description: string;
  type: FollowUpType;
  priority: Priority;
  /** One combined ISO-8601 timestamp, built from the form's date + time inputs. */
  scheduledAt: string;
  notes: string;
  reminder: boolean;
}

interface CreateFollowUpBody {
  clientId: string;
  enquiryId?: string;
  assignedToId?: string;
  subject: string;
  description?: string;
  type: BackendFollowUpType;
  priority: BackendPriority;
  scheduledAt: string;
  notes?: string;
  reminder: boolean;
}

function toCreateBody(values: FollowUpFormValues): CreateFollowUpBody {
  const body: CreateFollowUpBody = {
    clientId: values.clientId,
    subject: values.subject,
    type: TYPE_TO_BACKEND[values.type],
    priority: PRIORITY_TO_BACKEND[values.priority],
    scheduledAt: values.scheduledAt,
    reminder: values.reminder,
  };
  // Optional fields are omitted rather than sent empty: the backend's
  // @MinLength(1) rejects "" for the id fields, and an empty description or
  // note is genuinely "not provided", not a value worth storing.
  if (values.enquiryId) body.enquiryId = values.enquiryId;
  if (values.assignedToId) body.assignedToId = values.assignedToId;
  if (values.description) body.description = values.description;
  if (values.notes) body.notes = values.notes;
  return body;
}

export async function createFollowUp(values: FollowUpFormValues): Promise<FollowUp> {
  return toFollowUp(
    await apiFetch<BackendFollowUp>("/follow-ups", {
      method: "POST",
      body: JSON.stringify(toCreateBody(values)),
    }),
  );
}

/**
 * POST /follow-ups/auto-managed — the only way a Follow-up is created with
 * `isAutoManaged: true`. Same body shape as createFollowUp (there is no
 * `isAutoManaged` key to send; the backend sets it unconditionally for this
 * route — see FollowUpsService.createAutoManaged). Used exclusively by the
 * Enquiry-sync helpers (ensureNextFollowUp) in enquiries-content.tsx and
 * clients-content.tsx — never by the manual Follow-up form.
 */
export async function createAutoManagedFollowUp(values: FollowUpFormValues): Promise<FollowUp> {
  return toFollowUp(
    await apiFetch<BackendFollowUp>("/follow-ups/auto-managed", {
      method: "POST",
      body: JSON.stringify(toCreateBody(values)),
    }),
  );
}

/**
 * PATCH /follow-ups/:id. Deliberately omits `clientId` (the backend does not
 * allow re-parenting), `status`/`outcome` (those go through
 * updateFollowUpStatus) and id/organizationId/completedAt/timestamps (never
 * client-settable).
 *
 * `enquiryId` and `assignedToId` are sent as explicit `null` when cleared —
 * that is how the backend distinguishes "unlink" from "leave untouched".
 */
export async function updateFollowUp(
  id: string,
  values: FollowUpFormValues,
): Promise<FollowUp> {
  const body = {
    subject: values.subject,
    description: values.description,
    type: TYPE_TO_BACKEND[values.type],
    priority: PRIORITY_TO_BACKEND[values.priority],
    scheduledAt: values.scheduledAt,
    notes: values.notes,
    reminder: values.reminder,
    enquiryId: values.enquiryId || null,
    assignedToId: values.assignedToId || null,
  };

  return toFollowUp(
    await apiFetch<BackendFollowUp>(`/follow-ups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * PATCH /follow-ups/:id/status — the only way a status ever changes.
 *
 * `outcome` is required by the backend when completing and is rejected when
 * blank, so callers must collect it first (see the Complete dialog in
 * follow-ups-content.tsx). `completedAt` is never sent: the server stamps it.
 */
export async function updateFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  outcome?: string,
): Promise<FollowUp> {
  const body: { status: BackendFollowUpStatus; outcome?: string } = {
    status: STATUS_TO_BACKEND[status],
  };
  if (status === "completed" && outcome) body.outcome = outcome;

  return toFollowUp(
    await apiFetch<BackendFollowUp>(`/follow-ups/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Permanent removal — distinct from updateFollowUpStatus('cancelled'),
 * which keeps the record. Safe with no conflict response to handle:
 * FollowUp has no downstream FK dependencies.
 */
export async function deleteFollowUp(id: string): Promise<void> {
  await apiFetch<{ id: string }>(`/follow-ups/${id}`, { method: "DELETE" });
}
