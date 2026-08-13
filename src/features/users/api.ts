/**
 * Data layer for the Users feature: talks to the real NestJS backend
 * (POST/GET/PATCH /users) and maps between the backend's uppercase CRM
 * enums and this feature's existing lower-hyphenated UI representation
 * (see ./types.ts) so no component needs to know the backend's shape.
 */
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { CrmUser, CrmUserRole, CrmUserStatus } from "./types";

export type BackendUserRole = "SUPER_ADMIN" | "ADMIN" | "SALES_EXECUTIVE";
export type BackendUserStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: BackendUserRole;
  department: string;
  status: BackendUserStatus;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_FROM_BACKEND: Record<BackendUserRole, CrmUserRole> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  SALES_EXECUTIVE: "sales-executive",
};

const ROLE_TO_BACKEND: Record<CrmUserRole, BackendUserRole> = {
  "super-admin": "SUPER_ADMIN",
  admin: "ADMIN",
  "sales-executive": "SALES_EXECUTIVE",
};

// The existing UI only models a binary active/inactive state (CrmUserStatus
// has no "invited" value, and the table's status badge/toggle are binary —
// see user-table.tsx). A backend-INVITED account has no equivalent UI state
// yet, so it's shown as "inactive" (closest honest meaning: not yet able to
// use the CRM the way an active user can). The status toggle in this UI
// only ever sends ACTIVE or INACTIVE, never INVITED.
const STATUS_FROM_BACKEND: Record<BackendUserStatus, CrmUserStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  INVITED: "inactive",
};

const STATUS_TO_BACKEND: Record<CrmUserStatus, BackendUserStatus> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
};

function formatLastActive(lastActiveAt: string | null): string {
  return lastActiveAt ? formatRelativeTime(lastActiveAt) : "Never";
}

function toCrmUser(user: BackendUser): CrmUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: ROLE_FROM_BACKEND[user.role],
    department: user.department,
    status: STATUS_FROM_BACKEND[user.status],
    lastActive: formatLastActive(user.lastActiveAt),
  };
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: CrmUserRole;
  department: string;
}

export interface UpdateUserPayload {
  name?: string;
  role?: CrmUserRole;
  department?: string;
}

export async function listUsers(): Promise<CrmUser[]> {
  const users = await apiFetch<BackendUser[]>("/users");
  return users.map(toCrmUser);
}

export async function createUser(payload: CreateUserPayload): Promise<CrmUser> {
  const user = await apiFetch<BackendUser>("/users", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: ROLE_TO_BACKEND[payload.role],
      department: payload.department,
    }),
  });
  return toCrmUser(user);
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<CrmUser> {
  const body: { name?: string; role?: BackendUserRole; department?: string } = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.role !== undefined) body.role = ROLE_TO_BACKEND[payload.role];
  if (payload.department !== undefined) body.department = payload.department;

  const user = await apiFetch<BackendUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return toCrmUser(user);
}

export async function updateUserStatus(id: string, status: CrmUserStatus): Promise<CrmUser> {
  const user = await apiFetch<BackendUser>(`/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: STATUS_TO_BACKEND[status] }),
  });
  return toCrmUser(user);
}
