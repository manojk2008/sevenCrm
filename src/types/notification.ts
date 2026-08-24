// Phase 9: Notifications is a stateless, read-only presentation layer over
// Dashboard's Recent Activity feed (see backend/src/notifications). There is
// no read/unread persistence in this phase, so this type deliberately has
// no `read` field, and no `actor` field — none of the underlying events
// (Client/Enquiry/Quotation created, FollowUp completed) records who
// performed the action, only that and when it happened.
export type NotificationType =
  | "client-created"
  | "enquiry-created"
  | "quotation-created"
  | "follow-up-completed";

export interface Notification {
  /** Deterministic — event-type + underlying record id. Never random. */
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  /** ISO-8601, the real underlying record's timestamp. */
  timestamp: string;
  /** A real, existing route. Never a fabricated destination. */
  href: string;
}
