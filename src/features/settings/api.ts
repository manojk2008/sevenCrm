/**
 * Data layer for Settings: talks to the real NestJS backend (GET/PATCH
 * /organizations/me). This is the "current organization" settings API —
 * not org-management CRUD — so it never sends organizationId or id; the
 * backend identifies the organization exclusively from the session.
 */
import { apiFetch } from "@/lib/api";

export interface BackendOrganization {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  quotationHeaderText: string | null;
  quotationFooterText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMyOrganizationPayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstNumber?: string;
  primaryColor?: string;
  secondaryColor?: string;
  quotationHeaderText?: string;
  quotationFooterText?: string;
}

export async function getMyOrganization(): Promise<BackendOrganization> {
  return apiFetch<BackendOrganization>("/organizations/me");
}

export async function updateMyOrganization(
  payload: UpdateMyOrganizationPayload,
): Promise<BackendOrganization> {
  return apiFetch<BackendOrganization>("/organizations/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
