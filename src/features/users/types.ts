/**
 * Scoped to the Users feature. This is intentionally decoupled from the
 * Clerk-backed `UserRole` in `@/stores/auth-store` (which still models
 * `sales-manager` for org-role syncing) — it represents the CRM's own
 * user/role model, which is what the future NestJS + Prisma backend
 * and Better Auth will own. Values are lower-hyphenated to map 1:1
 * onto backend RBAC roles later.
 */
export type CrmUserRole = "super-admin" | "admin" | "sales-executive";

export type CrmUserStatus = "active" | "inactive";

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  department: string;
  status: CrmUserStatus;
  lastActive: string;
}

export const ROLE_LABELS: Record<CrmUserRole, string> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  "sales-executive": "Sales Executive",
};

export const ROLE_BADGE_CLASSES: Record<CrmUserRole, string> = {
  "super-admin": "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  "sales-executive": "bg-slate-100 text-slate-800 border-slate-200",
};

// Only these roles can be assigned through the Invite/Create User form —
// a Super Admin is never created from this form (see AGENTS.md).
export const INVITABLE_ROLES: CrmUserRole[] = ["admin", "sales-executive"];

export const DEPARTMENTS = ["Management", "Operations", "Sales"] as const;
export type Department = (typeof DEPARTMENTS)[number];
