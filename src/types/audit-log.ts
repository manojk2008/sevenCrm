/**
 * Mirrors backend/src/audit-logs/audit-logs.service.ts's SafeAuditLogListItem
 * / SafeAuditLogDetail — translated to this codebase's lower-case enum
 * convention by src/features/audit-logs/api.ts, same pattern as Task/
 * FollowUp.
 *
 * Audit logs are immutable and GET-only (Phase 16 decision log item 6):
 * there is no create/update/delete shape here, only what the read API
 * returns.
 */
export type AuditAction = "create" | "update" | "status-change";

export const AUDIT_ACTIONS: { value: AuditAction; label: string }[] = [
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "status-change", label: "Status changed" },
];

/**
 * Validated string, not a closed enum (mirrors the backend's entityType —
 * see backend/src/audit-logs/entity-config.ts) — a value the frontend
 * doesn't recognize is still rendered (falls back to the raw string),
 * rather than the row disappearing.
 */
export type AuditEntityType =
  | "CLIENT"
  | "ENQUIRY"
  | "QUOTATION"
  | "FOLLOW_UP"
  | "TASK"
  | "PRODUCT"
  | "PRODUCT_GROUP"
  | "USER"
  | "ORGANIZATION";

export const AUDIT_ENTITY_TYPES: { value: AuditEntityType; label: string }[] = [
  { value: "CLIENT", label: "Client" },
  { value: "ENQUIRY", label: "Enquiry" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "TASK", label: "Task" },
  { value: "PRODUCT", label: "Product" },
  { value: "PRODUCT_GROUP", label: "Product group" },
  { value: "USER", label: "User" },
  { value: "ORGANIZATION", label: "Organization" },
];

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogListItem {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actor: AuditLogActor | null;
  entityLabel: string | null;
  createdAt: string;
}

/**
 * `before`/`after` are whitelisted-field-only snapshots (never the full
 * record) — see the backend's AUDITED_MODELS. Plain unknown-shaped JSON
 * here since the whitelist differs per entityType; the detail view renders
 * whatever keys are present rather than assuming a fixed shape.
 */
export interface AuditLogDetail extends AuditLogListItem {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
