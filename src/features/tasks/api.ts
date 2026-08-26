/**
 * Data layer for the Tasks feature: talks to the real NestJS backend
 * (/tasks) and maps its response onto the canonical `Task` shape
 * (src/types/task.ts) — mirrors src/features/follow-ups/api.ts's pattern.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { Task, TaskUserRef } from "@/types/task";
import type { Priority } from "@/types/common";

export type BackendPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type BackendTaskStatus = "PENDING" | "COMPLETED";

/** Mirrors SafeTask in backend/src/tasks/tasks.service.ts. */
export interface BackendTask {
  id: string;
  organizationId: string;
  assignedToId: string | null;
  assignedTo: TaskUserRef | null;
  title: string;
  dueDate: string | null;
  priority: BackendPriority | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginatedTasks {
  data: BackendTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Enum translation — exhaustive `Record` maps, not toLowerCase()/toUpperCase()
// string munging, so a future enum value fails to compile instead of
// silently producing an invalid value. Mirrors follow-ups/api.ts.
// ---------------------------------------------------------------------------

const PRIORITY_FROM_BACKEND: Record<BackendPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const PRIORITY_TO_BACKEND: Record<Priority, BackendPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
};

export function toTask(task: BackendTask): Task {
  return {
    id: task.id,
    organizationId: task.organizationId,
    assignedToId: task.assignedToId,
    assignedTo: task.assignedTo,
    title: task.title,
    dueDate: task.dueDate,
    priority: task.priority ? PRIORITY_FROM_BACKEND[task.priority] : null,
    completed: task.completed,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** Task-specific 404 wording; falls back to the shared helper otherwise. */
export function getTaskErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "That task could not be found.";
  }
  return getFriendlyErrorMessage(error);
}

export interface ListTasksParams {
  search?: string;
  completed?: boolean;
  priority?: Priority | "all";
  assignedToId?: string;
  /** Full ISO-8601 timestamps — inclusive bounds on dueDate. */
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  pageSize?: number;
}

export interface TaskListResult {
  data: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * GET /tasks. Every filter is sent to the server — nothing is fetched
 * wholesale and narrowed in React. For a SALES_EXECUTIVE the backend
 * enforces its own-tasks-only restriction regardless of any filter sent
 * here; this is a convenience for ADMIN/SUPER_ADMIN, never the security
 * boundary.
 */
export async function listTasks(params: ListTasksParams = {}): Promise<TaskListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.completed !== undefined) query.set("completed", String(params.completed));
  if (params.priority && params.priority !== "all") {
    query.set("priority", PRIORITY_TO_BACKEND[params.priority]);
  }
  if (params.assignedToId) query.set("assignedToId", params.assignedToId);
  if (params.dueFrom) query.set("dueFrom", params.dueFrom);
  if (params.dueTo) query.set("dueTo", params.dueTo);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const result = await apiFetch<BackendPaginatedTasks>(`/tasks${qs ? `?${qs}` : ""}`);
  return { ...result, data: result.data.map(toTask) };
}

export async function getTask(id: string): Promise<Task> {
  return toTask(await apiFetch<BackendTask>(`/tasks/${id}`));
}

/** The values the Task form actually collects. */
export interface TaskFormValues {
  title: string;
  /** "" means unassigned (ADMIN/SUPER_ADMIN) or "assign to me" (Sales Executive, forced server-side). */
  assignedToId: string;
  /** "" means no due date. */
  dueDate: string;
  priority: Priority | "";
}

interface CreateTaskBody {
  title: string;
  assignedToId?: string;
  dueDate?: string;
  priority?: BackendPriority;
}

export async function createTask(values: TaskFormValues): Promise<Task> {
  const body: CreateTaskBody = { title: values.title };
  // Optional fields are omitted rather than sent empty: the backend rejects
  // an empty assignedToId/dueDate outright, and omitting is how a
  // SALES_EXECUTIVE's task is auto-assigned to themselves.
  if (values.assignedToId) body.assignedToId = values.assignedToId;
  if (values.dueDate) body.dueDate = values.dueDate;
  if (values.priority) body.priority = PRIORITY_TO_BACKEND[values.priority];

  return toTask(
    await apiFetch<BackendTask>("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * PATCH /tasks/:id. Deliberately omits completed/completedAt (those go
 * through updateTaskStatus) and id/organizationId/timestamps (never
 * client-settable).
 *
 * `assignedToId` is sent as explicit `null` when cleared — that is how the
 * backend distinguishes "unassign" from "leave untouched" (ADMIN/SUPER_ADMIN
 * only; the backend rejects any change at all for a SALES_EXECUTIVE other
 * than leaving it as their own id).
 */
export async function updateTask(id: string, values: TaskFormValues): Promise<Task> {
  const body = {
    title: values.title,
    assignedToId: values.assignedToId || null,
    dueDate: values.dueDate || undefined,
    priority: values.priority ? PRIORITY_TO_BACKEND[values.priority] : undefined,
  };

  return toTask(
    await apiFetch<BackendTask>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * PATCH /tasks/:id/status — the only way completion ever changes.
 * `completedAt` is never sent: the server stamps and clears it.
 */
export async function updateTaskStatus(id: string, completed: boolean): Promise<Task> {
  const status: BackendTaskStatus = completed ? "COMPLETED" : "PENDING";
  return toTask(
    await apiFetch<BackendTask>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  );
}
