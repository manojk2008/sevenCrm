/**
 * Centralized client for the SevenCRM NestJS backend. Every call sends the
 * Better Auth session cookie (`credentials: "include"`) rather than any
 * frontend-managed token — the backend session is the sole source of truth.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  /** HTTP status code, or 0 when the request never reached the server. */
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join(" ");
  }
  return undefined;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Check your connection and try again.");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON response body; leave `body` as null.
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(body) ?? `Request failed (${response.status}).`);
  }

  return body as T;
}

/**
 * A single, user-facing message for every error an API call can throw.
 * Never surfaces raw server/database details.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return error.message;
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return error.message || "You don't have permission to perform this action.";
      case 404:
        return "That user could not be found.";
      case 409:
        return "This email address is already in use.";
      case 0:
        return error.message;
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
