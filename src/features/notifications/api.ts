/**
 * Data layer for the Notifications feature: talks to the real NestJS
 * backend (GET /notifications) and maps its response onto
 * src/types/notification.ts — mirrors src/features/dashboard/api.ts's
 * pattern.
 *
 * Notifications is READ-ONLY and stateless in this phase (Phase 9 decision
 * D2): there is no read/unread state anywhere, so there is no mark-as-read
 * function here — only a single read.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { Notification, NotificationType } from "@/types/notification";

type BackendNotificationType =
  | "CLIENT_CREATED"
  | "ENQUIRY_CREATED"
  | "QUOTATION_CREATED"
  | "FOLLOW_UP_COMPLETED";

// Exhaustive Record, never `toLowerCase()` string munging — same rule as
// every other feature's api.ts, so an unhandled backend type fails to
// compile instead of silently producing an invalid value.
const TYPE_FROM_BACKEND: Record<BackendNotificationType, NotificationType> = {
  CLIENT_CREATED: "client-created",
  ENQUIRY_CREATED: "enquiry-created",
  QUOTATION_CREATED: "quotation-created",
  FOLLOW_UP_COMPLETED: "follow-up-completed",
};

interface BackendNotification {
  id: string;
  type: BackendNotificationType;
  title: string;
  description: string;
  timestamp: string;
  href: string;
}

interface BackendNotificationFeed {
  notifications: BackendNotification[];
}

/** A single, user-facing message for anything a Notifications call can throw. */
export function getNotificationsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That notification data could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

function toNotification(raw: BackendNotification): Notification {
  return {
    id: raw.id,
    type: TYPE_FROM_BACKEND[raw.type],
    title: raw.title,
    description: raw.description,
    timestamp: raw.timestamp,
    href: raw.href,
  };
}

export async function getNotifications(limit?: number): Promise<Notification[]> {
  const result = await apiFetch<BackendNotificationFeed>(
    `/notifications${limit ? `?limit=${limit}` : ""}`,
  );
  return result.notifications.map(toNotification);
}
