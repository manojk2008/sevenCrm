/**
 * Data layer for the Search feature: talks to the real NestJS backend
 * (GET /search) and returns its response as-is — the backend's shape
 * already matches src/types/search.ts exactly, so no mapping is needed
 * (mirrors src/features/dashboard/api.ts's pattern otherwise).
 *
 * Search is READ-ONLY.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { SearchResponse } from "@/types/search";

/** A single, user-facing message for anything a Search call can throw. */
export function getSearchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That search could not be completed.";
  }
  return getFriendlyErrorMessage(error);
}

export function search(query: string): Promise<SearchResponse> {
  return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
}
