/**
 * Data layer for the Tax Rates feature: talks to the real NestJS backend
 * (/tax-rates) and maps its response onto the frontend `TaxRate` shape
 * (src/types/tax-rate.ts) — mirrors src/features/products/api.ts's pattern.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { TaxRate } from "@/types/tax-rate";

export type BackendStatus = "ACTIVE" | "INACTIVE";
export type StatusFilter = "active" | "inactive" | "all";

/** Mirrors SafeTaxRate in backend/src/tax-rates/tax-rates.service.ts. */
export interface BackendTaxRate {
  id: string;
  organizationId: string;
  name: string;
  rate: number;
  isDefault: boolean;
  status: BackendStatus;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function toStatus(status: BackendStatus): "active" | "inactive" {
  return status === "INACTIVE" ? "inactive" : "active";
}

function toBackendStatus(status: "active" | "inactive"): BackendStatus {
  return status === "inactive" ? "INACTIVE" : "ACTIVE";
}

export function toTaxRate(rate: BackendTaxRate): TaxRate {
  return {
    id: rate.id,
    organizationId: rate.organizationId,
    name: rate.name,
    rate: rate.rate,
    isDefault: rate.isDefault,
    status: toStatus(rate.status),
    createdAt: rate.createdAt,
    updatedAt: rate.updatedAt,
  };
}

/** Tax-rate-specific 404/409 wording; falls back to the shared helper otherwise. */
export function getTaxRateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That tax rate could not be found.";
    if (error.status === 409) {
      return error.message || "A tax rate with this name already exists in your organization.";
    }
  }
  return getFriendlyErrorMessage(error);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export interface ListTaxRatesParams {
  search?: string;
  status?: StatusFilter;
  page?: number;
  pageSize?: number;
}

export async function listTaxRates(params: ListTaxRatesParams = {}): Promise<PaginatedResult<TaxRate>> {
  const qs = buildQuery({
    search: params.search,
    status: params.status && params.status !== "all" ? toBackendStatus(params.status) : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const result = await apiFetch<BackendPaginated<BackendTaxRate>>(`/tax-rates${qs}`);
  return { ...result, data: result.data.map(toTaxRate) };
}

export interface TaxRatePayload {
  name: string;
  rate: number;
  isDefault?: boolean;
}

export async function createTaxRate(payload: TaxRatePayload): Promise<TaxRate> {
  const rate = await apiFetch<BackendTaxRate>("/tax-rates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toTaxRate(rate);
}

export async function updateTaxRate(id: string, payload: Partial<TaxRatePayload>): Promise<TaxRate> {
  const rate = await apiFetch<BackendTaxRate>(`/tax-rates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return toTaxRate(rate);
}

export async function updateTaxRateStatus(id: string, status: "active" | "inactive"): Promise<TaxRate> {
  const rate = await apiFetch<BackendTaxRate>(`/tax-rates/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });
  return toTaxRate(rate);
}

/** Loads the org's active default tax rate, if any — used only to prefill a
 * new quotation line's rate field; never affects existing quotations. */
export async function getDefaultTaxRate(): Promise<TaxRate | null> {
  const result = await listTaxRates({ status: "active", pageSize: 100 });
  return result.data.find((rate) => rate.isDefault) ?? null;
}
