/**
 * Data layer for the Audit Logs feature: talks to the real NestJS backend
 * (/audit-logs) and maps its response onto the canonical AuditLog shapes
 * (src/types/audit-log.ts) — mirrors src/features/tasks/api.ts's pattern.
 *
 * Read-only: there is no create/update/delete here. Audit logs are
 * immutable and GET-only (see backend/src/audit-logs/audit-logs.controller.ts).
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { AuditAction, AuditLogActor, AuditLogDetail, AuditLogListItem } from "@/types/audit-log";

export type BackendAuditAction = "CREATE" | "UPDATE" | "STATUS_CHANGE" | "DELETE";

// Exhaustive Record, never toLowerCase() string munging — same rule as
// every other feature's api.ts, so an unhandled backend value fails to
// compile instead of silently producing an invalid value.
const ACTION_FROM_BACKEND: Record<BackendAuditAction, AuditAction> = {
  CREATE: "create",
  UPDATE: "update",
  STATUS_CHANGE: "status-change",
  // Not currently produced by the backend (no delete call sites yet — see
  // the AuditAction.DELETE comment in schema.prisma), mapped for
  // completeness so a future value never fails to compile here.
  DELETE: "status-change",
};

export const ACTION_TO_BACKEND: Record<AuditAction, BackendAuditAction> = {
  create: "CREATE",
  update: "UPDATE",
  "status-change": "STATUS_CHANGE",
};

interface BackendAuditLogListItem {
  id: string;
  action: BackendAuditAction;
  entityType: string;
  entityId: string;
  actor: AuditLogActor | null;
  entityLabel: string | null;
  createdAt: string;
}

interface BackendAuditLogDetail extends BackendAuditLogListItem {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface BackendPaginatedAuditLogs {
  data: BackendAuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function toListItem(row: BackendAuditLogListItem): AuditLogListItem {
  return {
    id: row.id,
    action: ACTION_FROM_BACKEND[row.action],
    entityType: row.entityType,
    entityId: row.entityId,
    actor: row.actor,
    entityLabel: row.entityLabel,
    createdAt: row.createdAt,
  };
}

function toDetail(row: BackendAuditLogDetail): AuditLogDetail {
  return {
    ...toListItem(row),
    before: row.before,
    after: row.after,
  };
}

/** A single, user-facing message for anything an Audit Logs call can throw. */
export function getAuditLogErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That audit log entry could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

export interface ListAuditLogsParams {
  search?: string;
  action?: AuditAction | "all";
  entityType?: string | "all";
  actorId?: string;
  entityId?: string;
  /** Full ISO-8601 timestamps — inclusive bounds on createdAt. */
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListResult {
  data: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * GET /audit-logs. Every filter is sent to the server — nothing is fetched
 * wholesale and narrowed in React. For a SALES_EXECUTIVE the backend
 * enforces its own-actor-events-only restriction regardless of any
 * `actorId` filter sent here; this is a convenience for ADMIN/SUPER_ADMIN,
 * never the security boundary.
 */
export async function listAuditLogs(params: ListAuditLogsParams = {}): Promise<AuditLogListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.action && params.action !== "all") query.set("action", ACTION_TO_BACKEND[params.action]);
  if (params.entityType && params.entityType !== "all") query.set("entityType", params.entityType);
  if (params.actorId) query.set("actorId", params.actorId);
  if (params.entityId) query.set("entityId", params.entityId);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedAuditLogs>(`/audit-logs${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toListItem) };
}

export async function getAuditLog(id: string): Promise<AuditLogDetail> {
  return toDetail(await apiFetch<BackendAuditLogDetail>(`/audit-logs/${id}`));
}
