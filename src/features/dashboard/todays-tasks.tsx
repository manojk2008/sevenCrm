"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CalendarCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow } from "date-fns";
import {
  listTasks,
  updateTaskStatus,
  createTask,
  updateTask,
  getTaskErrorMessage,
} from "@/features/tasks/api";
import { TaskForm } from "@/features/tasks/task-form";
import type { Task } from "@/types/task";
import type { TaskFormValues } from "@/features/tasks/api";

/** How many tasks the widget shows. */
const VISIBLE_COUNT = 8;

/** "Today" / "Tomorrow" / "12 Sep" — never a fabricated relative date. */
function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "d MMM");
}

export function TodaysTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Present while editing an existing task; absent (undefined) means the
  // form is in "create" mode. Every task shown here is already one the
  // viewer is allowed to edit — the backend has already scoped the list to
  // their own tasks for a Sales Executive, or the whole org otherwise.
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // The backend already scopes this to the caller's own tasks for a
      // Sales Executive — nothing is fetched org-wide and filtered here.
      const result = await listTasks({ pageSize: VISIBLE_COUNT });
      setTasks(result.data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getTaskErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const toggleTask = async (task: Task) => {
    if (togglingId) return;
    setTogglingId(task.id);
    // Optimistic, but reconciled with the real response — never left as a
    // locally-invented state if the request fails.
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
    );
    try {
      const updated = await updateTaskStatus(task.id, !task.completed);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      // Roll back — the toggle didn't actually happen.
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)),
      );
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => {
    setEditingTask(undefined);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleSubmit = async (values: TaskFormValues) => {
    if (editingTask) {
      await updateTask(editingTask.id, values);
    } else {
      await createTask(values);
    }
    setFormOpen(false);
    await load();
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Today&apos;s Tasks
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
            </CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading..."
                : tasks.length > 0
                  ? `${completedCount} of ${tasks.length} completed`
                  : "No tasks yet"}
            </CardDescription>
          </div>
          <button
            onClick={openCreate}
            aria-label="Add task"
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {!isLoading && tasks.length > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5 mb-5 overflow-hidden">
              <motion.div
                className="bg-indigo-500 h-1.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="py-6 text-center space-y-3 flex-1 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <button
                onClick={load}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && tasks.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
              No tasks yet. Click + to add one.
            </div>
          )}

          {!isLoading && !errorMessage && tasks.length > 0 && (
            <div className="space-y-1 flex-1">
              {tasks.map((task) => {
                const due = formatDueDate(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      disabled={togglingId === task.id}
                      aria-label={task.completed ? "Mark as pending" : "Mark as complete"}
                      className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                        task.completed
                          ? "bg-indigo-500 border-indigo-500 text-white"
                          : "border-slate-300 dark:border-slate-600 group-hover:border-indigo-400",
                      )}
                    >
                      {task.completed && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => openEdit(task)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span
                        className={cn(
                          "text-sm select-none transition-colors block truncate",
                          task.completed
                            ? "text-muted-foreground line-through"
                            : "text-slate-700 dark:text-slate-200 group-hover:underline",
                        )}
                      >
                        {task.title}
                      </span>
                      {(due || task.assignedTo) && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {[due, task.assignedTo?.name].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>
                    {task.priority && (
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
                          task.priority === "urgent" &&
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
                          task.priority === "high" &&
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                          task.priority === "medium" &&
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          task.priority === "low" &&
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                        )}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        onSubmit={handleSubmit}
      />
    </motion.div>
  );
}
