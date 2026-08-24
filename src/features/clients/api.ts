/**
 * Data layer for the Clients feature: talks to the real NestJS backend
 * (/clients) and maps its response into the existing ClientRecord shape
 * (defined in ./client-form.tsx, already consumed by clients-content.tsx
 * and client-detail-content.tsx) so no component needs to know the
 * backend's shape — mirrors src/features/users/api.ts's pattern.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { ClientFormValues, ClientRecord, ClientContactRecord } from "./client-form";

export type BackendClientStatus = "ACTIVE" | "INACTIVE";

export interface BackendClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendClient {
  id: string;
  organizationId: string;
  companyName: string;
  industry: string;
  website: string | null;
  email: string;
  phone: string;
  gstNumber: string | null;
  status: BackendClientStatus;
  churnReason: string | null;
  tags: string[];
  notes: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  totalDeals: number;
  totalRevenue: number;
  assignedTo: { id: string; name: string; email: string } | null;
  contacts: BackendClientContact[];
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginatedClients {
  data: BackendClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fields declared on the frontend's Client type (src/types/client.ts) with
 * no backend counterpart: `logo` and Contact.`avatar` are never rendered
 * anywhere in the Clients UI (dead fields, not carried over). `assignedTo`
 * IS returned by the backend but has no display slot in the current UI
 * (pre-existing, not added here per "do not redesign the UI").
 */
function toContactRecord(contact: BackendClientContact): ClientContactRecord {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    designation: contact.designation ?? undefined,
    isPrimary: contact.isPrimary,
  };
}

export function toClientRecord(client: BackendClient): ClientRecord {
  const primary = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  return {
    id: client.id,
    name: client.companyName,
    contactperson: primary?.name ?? "",
    industry: client.industry,
    email: client.email,
    phone: client.phone,
    website: client.website ?? "",
    gstNumber: client.gstNumber ?? "",
    status: client.status === "INACTIVE" ? "inactive" : "active",
    churnReason: client.churnReason ?? "",
    tags: client.tags,
    revenue: client.totalRevenue,
    totalDeals: client.totalDeals,
    lastActivity: client.updatedAt,
    primaryContact: {
      name: primary?.name ?? "",
      phone: primary?.phone ?? "",
      email: primary?.email ?? "",
      designation: primary?.designation ?? "",
    },
    address: {
      line1: client.address.line1,
      line2: client.address.line2 ?? undefined,
      city: client.address.city,
      state: client.address.state,
      pincode: client.address.pincode,
      country: client.address.country,
    },
    notes: client.notes ?? "",
    assignedTo: client.assignedTo,
    contacts: client.contacts.map(toContactRecord),
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

/** Clients-specific 404/409 wording; falls back to the shared helper otherwise. */
export function getClientErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That client could not be found.";
    // The backend distinguishes email vs GST conflicts in error.message —
    // surface it directly rather than the shared helper's hardcoded,
    // email-only wording.
    if (error.status === 409) return error.message || "This conflicts with an existing client record.";
  }
  return getFriendlyErrorMessage(error);
}

export interface ListClientsParams {
  search?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
}

export interface ClientListResult {
  data: ClientRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listClients(params: ListClientsParams = {}): Promise<ClientListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") {
    query.set("status", params.status === "active" ? "ACTIVE" : "INACTIVE");
  }
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedClients>(`/clients${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toClientRecord) };
}

export async function getClient(id: string): Promise<ClientRecord> {
  const client = await apiFetch<BackendClient>(`/clients/${id}`);
  return toClientRecord(client);
}

interface ClientCorePayload {
  companyName: string;
  industry: string;
  website?: string;
  email: string;
  phone: string;
  gstNumber?: string;
  tags?: string[];
  notes?: string;
  addressLine1: string;
  addressLine2?: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  addressCountry?: string;
}

// The form has no dedicated company-email input (see client-form.tsx) — the
// primary contact's email is the only email the user actually enters, so it
// is used for both the contact record and the client's own `email` field.
function toCorePayload(values: ClientFormValues): ClientCorePayload {
  return {
    companyName: values.name,
    industry: values.industry,
    // No `website` input exists in the form (see client-form.tsx) — omitted
    // entirely rather than sent as undefined, so PATCH never touches it.
    email: values.primaryContact.email,
    phone: values.phone,
    gstNumber: values.gstNumber || undefined,
    tags: values.tags,
    notes: values.notes || undefined,
    addressLine1: values.address.line1,
    addressLine2: values.address.line2 || undefined,
    addressCity: values.address.city,
    addressState: values.address.state,
    addressPincode: values.address.pincode,
    addressCountry: values.address.country,
  };
}

async function createClientRaw(values: ClientFormValues): Promise<BackendClient> {
  return apiFetch<BackendClient>("/clients", {
    method: "POST",
    body: JSON.stringify(toCorePayload(values)),
  });
}

async function updateClientCoreRaw(id: string, values: ClientFormValues): Promise<BackendClient> {
  return apiFetch<BackendClient>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toCorePayload(values)),
  });
}

async function updateClientStatusRaw(
  id: string,
  status: "active" | "inactive",
  churnReason?: string,
): Promise<BackendClient> {
  const body: { status: BackendClientStatus; churnReason?: string } = {
    status: status === "inactive" ? "INACTIVE" : "ACTIVE",
  };
  if (status === "inactive" && churnReason) body.churnReason = churnReason;
  return apiFetch<BackendClient>(`/clients/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Direct status change — used by the list/detail "Deactivate/Reactivate" actions. */
export async function updateClientStatus(
  id: string,
  status: "active" | "inactive",
  churnReason?: string,
): Promise<ClientRecord> {
  return toClientRecord(await updateClientStatusRaw(id, status, churnReason));
}

async function syncPrimaryContact(
  clientId: string,
  values: ClientFormValues,
  existingPrimary: BackendClientContact | undefined,
): Promise<void> {
  if (!values.primaryContact.name) return;
  const payload = {
    name: values.primaryContact.name,
    email: values.primaryContact.email || undefined,
    phone: values.primaryContact.phone || undefined,
    designation: values.primaryContact.designation || undefined,
    isPrimary: true,
  };
  if (existingPrimary) {
    await apiFetch(`/clients/${clientId}/contacts/${existingPrimary.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } else {
    await apiFetch(`/clients/${clientId}/contacts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

/**
 * Orchestrates what a single ClientForm submission actually needs against
 * the real API: the backend splits "client record", "status", and
 * "contacts" into three separate endpoints (see backend/src/clients), but
 * the existing form still submits all of it as one save. Core client save
 * failures reject the whole save (surfaced by ClientForm's own error
 * toast); a failure in the secondary contact-sync or status-change step is
 * reported with its own toast rather than claiming the whole save failed,
 * since the client record itself was genuinely saved by that point.
 */
export async function saveClientForm(
  values: ClientFormValues,
  existing: ClientRecord | undefined,
  onPartialFailure: (message: string) => void,
): Promise<ClientRecord> {
  let backendClient: BackendClient;
  let existingPrimaryContact: BackendClientContact | undefined;

  if (!existing) {
    backendClient = await createClientRaw(values);
  } else {
    backendClient = await updateClientCoreRaw(existing.id, values);
    existingPrimaryContact = backendClient.contacts.find((c) => c.isPrimary) ?? backendClient.contacts[0];
  }

  try {
    await syncPrimaryContact(backendClient.id, values, existingPrimaryContact);
  } catch (error) {
    onPartialFailure(`Client saved, but the primary contact could not be saved: ${getClientErrorMessage(error)}`);
  }

  const previousStatus = existing?.status ?? "active";
  if (values.status !== previousStatus) {
    try {
      backendClient = await updateClientStatusRaw(backendClient.id, values.status, values.churnReason);
    } catch (error) {
      onPartialFailure(`Client saved, but the status change could not be applied: ${getClientErrorMessage(error)}`);
    }
  }

  // Refetch so the returned record reflects contacts + status together,
  // rather than assembling it from three possibly-inconsistent responses.
  return getClient(backendClient.id);
}
