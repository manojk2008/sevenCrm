/**
 * Thin wrapper over Better Auth's HTTP endpoints on the NestJS backend
 * (mounted at /api/auth). No auth SDK is used here — these are the same
 * endpoints verified directly against the backend; the browser's session
 * cookie (set by the backend, sent via credentials:"include") is the only
 * form of auth state that crosses the network.
 */
import { apiFetch } from "./api";

export type BackendCrmRole = "SUPER_ADMIN" | "ADMIN" | "SALES_EXECUTIVE";
export type BackendCrmStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export interface BackendSessionUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  crmRole: BackendCrmRole;
  department: string;
  status: BackendCrmStatus;
}

interface BackendSession {
  user: BackendSessionUser;
  session: Record<string, unknown>;
}

export async function fetchSession(): Promise<BackendSession | null> {
  return apiFetch<BackendSession | null>("/api/auth/get-session");
}

export async function signInWithEmail(email: string, password: string): Promise<BackendSessionUser> {
  const result = await apiFetch<{ user: BackendSessionUser }>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export async function signOut(): Promise<void> {
  await apiFetch("/api/auth/sign-out", { method: "POST" });
}
