/**
 * Data layer for the self-service Profile page: talks to the real NestJS
 * backend (PATCH /users/me). Unlike the Users admin feature, this never
 * sends userId or organizationId — the backend identifies the caller
 * exclusively from the authenticated session.
 */
import { apiFetch } from "@/lib/api";

export interface UpdateMyProfilePayload {
  name?: string;
  department?: string;
}

export interface BackendProfileUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SALES_EXECUTIVE";
  department: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED";
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload): Promise<BackendProfileUser> {
  return apiFetch<BackendProfileUser>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
