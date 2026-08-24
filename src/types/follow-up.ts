import type { Priority } from "./common";

export type FollowUpType = "call" | "email" | "meeting" | "demo" | "visit";

/**
 * The three real, persisted statuses — deliberately no "overdue".
 *
 * Overdue is a derived, display-only state the backend computes on every read
 * (`status === SCHEDULED && scheduledAt < now`) and exposes as `isOverdue`.
 * Modelling it as a fourth status would make it impossible to say whether an
 * overdue follow-up is still scheduled, and would go stale the moment the
 * clock moved past `scheduledAt`.
 */
export type FollowUpStatus = "scheduled" | "completed" | "cancelled";

/** Trimmed client reference, resolved by the backend from the Client relation. */
export interface FollowUpClientRef {
  id: string;
  companyName: string;
}

/** Trimmed enquiry reference, resolved by the backend from the Enquiry relation. */
export interface FollowUpEnquiryRef {
  id: string;
  title: string;
}

/** Trimmed user reference, resolved by the backend from the User relation. */
export interface FollowUpUserRef {
  id: string;
  name: string;
  email: string;
}

/**
 * The canonical Follow-up shape for the whole frontend — mirrors SafeFollowUp
 * in backend/src/follow-ups/follow-ups.service.ts, translated to this
 * codebase's lower-case enum convention by src/features/follow-ups/api.ts.
 *
 * Nothing is denormalized: `client`, `enquiry` and `assignedTo` are the real
 * related records the backend resolved, so a renamed client shows its current
 * name here without any local cache to invalidate.
 */
export interface FollowUp {
  id: string;
  organizationId: string;

  clientId: string;
  client: FollowUpClientRef;

  enquiryId: string | null;
  enquiry: FollowUpEnquiryRef | null;

  assignedToId: string | null;
  assignedTo: FollowUpUserRef | null;

  subject: string;
  description: string | null;

  type: FollowUpType;
  priority: Priority;
  status: FollowUpStatus;

  /** Full ISO-8601 timestamp — a single value, never a separate date + time. */
  scheduledAt: string;
  /** Set by the backend when the follow-up is completed; never client-supplied. */
  completedAt: string | null;
  outcome: string | null;
  notes: string | null;

  /**
   * A plain user-set flag. No notification is delivered for it in this phase,
   * and no reminder *offset* is stored — so the UI must not present one.
   */
  reminder: boolean;

  /** Derived by the backend; never stored. See FollowUpStatus above. */
  isOverdue: boolean;

  createdAt: string;
  updatedAt: string;
}

export const FOLLOW_UP_TYPES: { value: FollowUpType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "demo", label: "Demo" },
  { value: "visit", label: "Visit" },
];

export const FOLLOW_UP_STATUSES: { value: FollowUpStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const FOLLOW_UP_PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
