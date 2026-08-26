import type { Priority } from "./common";

/** Trimmed user reference, resolved by the backend from the User relation. */
export interface TaskUserRef {
  id: string;
  name: string;
  email: string;
}

/**
 * The canonical Task shape for the whole frontend — mirrors SafeTask in
 * backend/src/tasks/tasks.service.ts, translated to this codebase's
 * lower-case enum convention by src/features/tasks/api.ts.
 *
 * Deliberately independent of Client/Enquiry — see FollowUp, which requires
 * a client. A Task is a generic personal/team to-do.
 */
export interface Task {
  id: string;
  organizationId: string;

  assignedToId: string | null;
  assignedTo: TaskUserRef | null;

  title: string;

  /** Full ISO-8601 timestamp, or null when the task has no due date. */
  dueDate: string | null;
  priority: Priority | null;

  completed: boolean;
  /** Set by the backend when the task is completed; never client-supplied. */
  completedAt: string | null;

  createdAt: string;
  updatedAt: string;
}
