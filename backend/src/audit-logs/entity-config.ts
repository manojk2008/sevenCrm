/**
 * The single source of truth for what audit.extension.ts is allowed to
 * write, and what audit-logs.service.ts is allowed to filter/return by
 * entityType. Covers exactly the nine mutable "completed modules" (see the
 * Phase 16 decision log) — Sales/Analytics/Search/Dashboard/Notifications
 * are read-only and intentionally absent, and so is anything backing
 * Better Auth's own credential storage (Account/Session/Verification are
 * simply never keyed here, which is what keeps password/hash/session/
 * access/refresh/ID/verification-token data structurally unreachable by the
 * audit path — not a field-level exclusion, a whole-model one).
 *
 * `fields` is a whitelist, not a convenience list: before/after snapshots in
 * audit.extension.ts only ever contain these keys. Extending audit coverage
 * to a new module means adding an entry here, never adding a call in that
 * module's own service (see decision log item 3).
 */

export const AUDITED_ENTITY_TYPES = [
  'CLIENT',
  'ENQUIRY',
  'QUOTATION',
  'FOLLOW_UP',
  'TASK',
  'PRODUCT',
  'PRODUCT_GROUP',
  'USER',
  'ORGANIZATION',
] as const;

export type AuditedEntityType = (typeof AUDITED_ENTITY_TYPES)[number];

/**
 * Every `label` below reads a Prisma-schema-guaranteed non-nullable String
 * column, but the row itself is typed as `Record<string, unknown>` — so
 * `String(value)` would trip `no-base-to-string` (it can't know that). This
 * makes the narrowing explicit instead of asserting past it.
 */
function toLabel(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface AuditModelConfig {
  entityType: AuditedEntityType;
  /** Whitelisted field names snapshotted into `before`/`after`. */
  fields: readonly string[];
  /**
   * When present, and this field is among the fields that changed on an
   * `update`, the recorded action is STATUS_CHANGE instead of UPDATE.
   */
  statusField?: string;
  /** Human-readable label for the affected row, e.g. a Client's companyName. */
  label: (row: Record<string, unknown>) => string;
}

/** Keyed by the Prisma schema's PascalCase model name (not the @@map'd table name). */
export const AUDITED_MODELS: Record<string, AuditModelConfig> = {
  Client: {
    entityType: 'CLIENT',
    statusField: 'status',
    fields: [
      'companyName',
      'industry',
      'website',
      'email',
      'phone',
      'gstNumber',
      'status',
      'churnReason',
      'tags',
      'notes',
      'addressLine1',
      'addressLine2',
      'addressCity',
      'addressState',
      'addressPincode',
      'addressCountry',
      'assignedToId',
    ],
    label: (row) => toLabel(row.companyName),
  },
  Enquiry: {
    entityType: 'ENQUIRY',
    statusField: 'stage',
    fields: [
      'title',
      'stage',
      'expectedRevenue',
      'probability',
      'priority',
      'source',
      'description',
      'notes',
      'expectedCloseDate',
      'lostReason',
      'tags',
      'assignedToId',
    ],
    label: (row) => toLabel(row.title),
  },
  Quotation: {
    entityType: 'QUOTATION',
    statusField: 'status',
    fields: [
      'status',
      'validUntil',
      'notes',
      'terms',
      'subtotal',
      'discountAmount',
      'taxAmount',
      'grandTotal',
      'assignedToId',
    ],
    label: (row) => toLabel(row.quotationNumber),
  },
  FollowUp: {
    entityType: 'FOLLOW_UP',
    statusField: 'status',
    fields: [
      'subject',
      'description',
      'type',
      'priority',
      'status',
      'scheduledAt',
      'completedAt',
      'outcome',
      'notes',
      'reminder',
      'assignedToId',
    ],
    label: (row) => toLabel(row.subject),
  },
  Task: {
    entityType: 'TASK',
    // Task has no dedicated status enum — `completed` is its status field
    // (see backend/src/tasks/tasks.service.ts.updateStatus).
    statusField: 'completed',
    fields: [
      'title',
      'dueDate',
      'priority',
      'completed',
      'completedAt',
      'assignedToId',
    ],
    label: (row) => toLabel(row.title),
  },
  Product: {
    entityType: 'PRODUCT',
    statusField: 'status',
    fields: [
      'name',
      'description',
      'price',
      'sku',
      'unit',
      'status',
      'productGroupId',
    ],
    label: (row) => toLabel(row.name),
  },
  ProductGroup: {
    entityType: 'PRODUCT_GROUP',
    statusField: 'status',
    fields: ['name', 'description', 'status'],
    label: (row) => toLabel(row.name),
  },
  User: {
    entityType: 'USER',
    statusField: 'status',
    // Deliberately excludes betterAuthRole/banned/banReason/banExpires (Better
    // Auth admin-plugin internals, not CRM data) and everything credential-
    // shaped, none of which lives on User anyway — see the module comment.
    fields: ['name', 'email', 'role', 'department', 'status'],
    label: (row) => toLabel(row.name),
  },
  Organization: {
    entityType: 'ORGANIZATION',
    fields: [
      'name',
      'slug',
      'address',
      'phone',
      'email',
      'website',
      'gstNumber',
    ],
    label: (row) => toLabel(row.name),
  },
};
