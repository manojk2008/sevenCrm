"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listUsers } from "@/features/users/api";
import { useAuthStore } from "@/stores/auth-store";
import type { Task } from "@/types/task";
import type { Priority } from "@/types/common";
import type { TaskFormValues } from "./api";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface UserOption {
  id: string;
  label: string;
}

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  task?: Task;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

function resolveLabel(
  value: unknown,
  options: { value: string; label: string }[],
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

/** ISO-8601 instant -> the browser's local yyyy-mm-dd for a date input. */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** yyyy-mm-dd -> a full ISO-8601 instant at local midnight, or "" if empty. */
function fromDateInputValue(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if ([year, month, day].some((part) => !Number.isFinite(part))) return "";
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function TaskForm({ open, onOpenChange, task, onSubmit }: TaskFormProps) {
  const isEdit = !!task;
  const { user } = useAuthStore();
  // A Sales Executive's task is always their own: the backend forces and
  // enforces this, and hiding the assignee picker here matches that — the
  // frontend must not merely hide the restriction, but there is genuinely
  // nothing for them to choose here.
  const canAssignOthers = user?.role === "super-admin" || user?.role === "admin";

  // The parent renders this component only while the dialog is open, so it
  // remounts on every open — prefilling from props here is enough, and
  // avoids a reset effect (same convention as FollowUpForm).
  const [title, setTitle] = useState(task?.title ?? "");
  const [assignedToId, setAssignedToId] = useState(task?.assignedToId ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate));
  const [priority, setPriority] = useState<Priority | "">(task?.priority ?? "");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Real Users data — no mock list. Only fetched for a role that can
  // actually assign to someone else; a Sales Executive is not authorized to
  // list org users (GET /users is SUPER_ADMIN/ADMIN only), so calling it
  // here would just fail.
  useEffect(() => {
    if (!open || !canAssignOthers) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await listUsers();
        if (cancelled) return;
        setUsers(result.map((u) => ({ id: u.id, label: u.name })));
        setOptionsError("");
      } catch {
        if (cancelled) return;
        setOptionsError("Couldn't load users. Close and reopen to retry.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, canAssignOthers]);

  const canSubmit = title.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setFormError("");
    try {
      await onSubmit({
        title: title.trim(),
        assignedToId,
        dueDate: fromDateInputValue(dueDate),
        priority,
      });
      // The parent closes the dialog on success; entered values are left
      // intact here so a failure keeps the user's work.
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save the task.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this task's details." : "Add a task to your list."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1 py-4">
          {optionsError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {optionsError}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              className="rounded-xl"
              placeholder="e.g. Call TCS for demo follow-up"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority || "none"}
                onValueChange={(value) => setPriority(value === "none" ? "" : (value as Priority))}
                disabled={isSaving}
              >
                <SelectTrigger id="task-priority" className="rounded-xl">
                  <SelectValue placeholder="None">
                    {(value: unknown) =>
                      value === "none"
                        ? "None"
                        : resolveLabel(value, PRIORITY_OPTIONS, "None")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canAssignOthers && (
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign to</Label>
              <Select
                value={assignedToId || "unassigned"}
                onValueChange={(value) => value && setAssignedToId(value === "unassigned" ? "" : value)}
                disabled={isSaving}
              >
                <SelectTrigger id="task-assignee" className="rounded-xl">
                  <SelectValue placeholder="Unassigned">
                    {(value: unknown) =>
                      value === "unassigned"
                        ? "Unassigned"
                        : resolveLabel(value, users.map((u) => ({ value: u.id, label: u.label })), "Unassigned")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
