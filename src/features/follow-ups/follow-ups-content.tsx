"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  List as ListIcon,
  Mail,
  MonitorPlay,
  MoreHorizontal,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { listClients } from "@/features/clients/api";
import { listUsers } from "@/features/users/api";
import {
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_TYPES,
  type FollowUp,
  type FollowUpStatus,
  type FollowUpType,
} from "@/types/follow-up";
import type { Priority } from "@/types/common";
import {
  createFollowUp,
  getFollowUpErrorMessage,
  listFollowUps,
  updateFollowUp,
  updateFollowUpStatus,
  type FollowUpFormValues,
  type ListFollowUpsParams,
} from "./api";
import { FollowUpForm } from "./follow-up-form";
import { FollowUpDetail } from "./follow-up-detail";

type LoadState = "loading" | "error" | "ready";
type View = "calendar" | "list";

interface FollowUpsContentProps {
  /**
   * True when rendered by the /follow-ups/new route, which exists so that
   * route (linked from the command palette and the dashboard's quick
   * actions) opens the real create flow instead of 404ing. Read once as the
   * dialog's initial state — deterministic on server and client alike, so it
   * needs no effect and cannot mismatch during hydration.
   */
  initialCreateOpen?: boolean;
}

const PAGE_SIZE = 10;
/** The backend's ceiling — see ListFollowUpsQueryDto. */
const MAX_PAGE_SIZE = 100;

const TYPE_ICONS: Record<FollowUpType, React.ComponentType<{ className?: string }>> = {
  call: PhoneCall,
  email: Mail,
  meeting: Users,
  demo: MonitorPlay,
  visit: Car,
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_DOTS: Record<Priority, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const STATUS_STYLES: Record<FollowUpStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

/**
 * Base UI's <Select.Value> renders the raw `value` unless it is given a render
 * function — which would show "all", or a bare client cuid, in the filter
 * trigger. Each filter below resolves its own label from its option list.
 */
function resolveLabel(
  value: unknown,
  options: { value: string; label: string }[],
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={`${PRIORITY_STYLES[priority]} rounded-md border font-normal capitalize`}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ followUp }: { followUp: FollowUp }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge className={`${STATUS_STYLES[followUp.status]} border-0 font-medium capitalize`}>
        {followUp.status}
      </Badge>
      {/* Display-only, derived from the backend's isOverdue — never a status. */}
      {followUp.isOverdue && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Overdue
        </Badge>
      )}
    </span>
  );
}

export function FollowUpsContent({ initialCreateOpen = false }: FollowUpsContentProps = {}) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  // Every CRM role may schedule, edit and complete follow-ups (this is
  // day-to-day sales work), matching FollowUpsService's authorization. The
  // backend remains the actual boundary; this component gates nothing.

  const [view, setView] = useState<View>("calendar");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters. Every one of these is sent to the server — nothing is fetched
  // wholesale and narrowed in React, so `total` and the calendar always
  // reflect the same query.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [typeFilter, setTypeFilter] = useState<FollowUpType | "all">("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  const [clientOptions, setClientOptions] = useState<{ id: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ id: string; label: string }[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(initialCreateOpen);
  const [editing, setEditing] = useState<FollowUp | undefined>(undefined);
  const [detail, setDetail] = useState<FollowUp | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [completing, setCompleting] = useState<FollowUp | null>(null);
  const [outcome, setOutcome] = useState("");
  const [cancelling, setCancelling] = useState<FollowUp | null>(null);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  // The calendar grid always starts on a Sunday and ends on a Saturday, so
  // the query range must cover the padding days too — otherwise a follow-up
  // shown in a trailing cell would be missing from the data behind it.
  const calendarRange = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(monthStart);
    const start = new Date(monthStart);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(monthEnd);
    end.setDate(end.getDate() + (6 - end.getDay()));
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [calendarMonth]);

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarRange.start, end: calendarRange.end }),
    [calendarRange],
  );

  const loadFollowUps = useCallback(async () => {
    setLoadState("loading");
    try {
      const params: ListFollowUpsParams = {
        search,
        status: statusFilter,
        priority: priorityFilter,
        type: typeFilter,
      };
      if (clientFilter !== "all") params.clientId = clientFilter;
      if (assigneeFilter !== "all") params.assignedToId = assigneeFilter;
      if (overdueOnly) params.overdue = true;

      if (view === "calendar") {
        // The calendar shows a whole month at once, so it asks for the
        // visible range instead of a page. An explicit date-range filter
        // still wins — it is the narrower, user-stated intent.
        params.scheduledFrom = (scheduledFrom
          ? new Date(`${scheduledFrom}T00:00:00`)
          : calendarRange.start
        ).toISOString();
        params.scheduledTo = (scheduledTo
          ? new Date(`${scheduledTo}T23:59:59.999`)
          : calendarRange.end
        ).toISOString();
        params.pageSize = MAX_PAGE_SIZE;
        params.page = 1;
      } else {
        if (scheduledFrom) {
          params.scheduledFrom = new Date(`${scheduledFrom}T00:00:00`).toISOString();
        }
        if (scheduledTo) {
          params.scheduledTo = new Date(`${scheduledTo}T23:59:59.999`).toISOString();
        }
        params.page = page;
        params.pageSize = PAGE_SIZE;
      }

      const result = await listFollowUps(params);
      setFollowUps(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getFollowUpErrorMessage(error));
      setLoadState("error");
    }
  }, [
    search,
    statusFilter,
    priorityFilter,
    typeFilter,
    clientFilter,
    assigneeFilter,
    overdueOnly,
    scheduledFrom,
    scheduledTo,
    view,
    calendarRange,
    page,
    handleUnauthorized,
  ]);

  useEffect(() => {
    Promise.resolve().then(loadFollowUps);
  }, [loadFollowUps]);

  // Debounce free-text search before it drives a request; resets to page 1 in
  // the same tick rather than a separate reactive effect (mirrors
  // quotations-content.tsx).
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Filter dropdown options come from the real Clients/Users APIs. A failure
  // here leaves those two filters empty rather than blocking the page — the
  // follow-up list itself has its own error state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clientResult, userResult] = await Promise.all([
          listClients({ status: "all", pageSize: MAX_PAGE_SIZE }),
          listUsers(),
        ]);
        if (cancelled) return;
        setClientOptions(clientResult.data.map((c) => ({ id: c.id, label: c.name })));
        setUserOptions(userResult.map((u) => ({ id: u.id, label: u.name })));
      } catch {
        // Intentionally silent — see above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFiltered =
    !!search ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    clientFilter !== "all" ||
    assigneeFilter !== "all" ||
    overdueOnly ||
    !!scheduledFrom ||
    !!scheduledTo;

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setClientFilter("all");
    setAssigneeFilter("all");
    setScheduledFrom("");
    setScheduledTo("");
    setOverdueOnly(false);
    setPage(1);
  };

  const followUpsForDate = useCallback(
    (date: Date) => followUps.filter((f) => isSameDay(new Date(f.scheduledAt), date)),
    [followUps],
  );

  const openCreate = () => {
    setEditing(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (followUp: FollowUp) => {
    setEditing(followUp);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const openDetail = (followUp: FollowUp) => {
    setDetail(followUp);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (values: FollowUpFormValues) => {
    // Errors propagate to the form, which shows them inline and keeps the
    // user's input — nothing is reported as saved that wasn't.
    if (editing) {
      await updateFollowUp(editing.id, values);
    } else {
      await createFollowUp(values);
    }
    setIsFormOpen(false);
    setEditing(undefined);
    await loadFollowUps();
  };

  const openComplete = (followUp: FollowUp) => {
    setCompleting(followUp);
    setOutcome("");
    setStatusError("");
    setIsDetailOpen(false);
  };

  const confirmComplete = async () => {
    if (!completing || outcome.trim().length === 0) return;
    setIsStatusSaving(true);
    setStatusError("");
    try {
      await updateFollowUpStatus(completing.id, "completed", outcome.trim());
      setCompleting(null);
      setOutcome("");
      await loadFollowUps();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setStatusError(getFollowUpErrorMessage(error));
    } finally {
      setIsStatusSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    setIsStatusSaving(true);
    setStatusError("");
    try {
      // Cancellation is a status change, never a delete — the record and its
      // history survive.
      await updateFollowUpStatus(cancelling.id, "cancelled");
      setCancelling(null);
      await loadFollowUps();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setStatusError(getFollowUpErrorMessage(error));
    } finally {
      setIsStatusSaving(false);
    }
  };

  const selectedDayFollowUps = selectedDate ? followUpsForDate(selectedDate) : [];
  // The calendar can only render what one page holds; say so rather than
  // silently showing a partial month.
  const calendarTruncated = view === "calendar" && total > followUps.length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Follow-ups</h1>
          <p className="mt-1 text-muted-foreground">Schedule and track client interactions</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Follow-up
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by subject or client..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-xl bg-slate-50 pl-9 dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center rounded-xl bg-muted p-1">
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="icon"
              aria-label="Calendar view"
              aria-pressed={view === "calendar"}
              className={`h-8 w-8 rounded-lg ${view === "calendar" ? "shadow-sm" : ""}`}
              onClick={() => setView("calendar")}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="icon"
              aria-label="List view"
              aria-pressed={view === "list"}
              className={`h-8 w-8 rounded-lg ${view === "list" ? "shadow-sm" : ""}`}
              onClick={() => {
                setView("list");
                setPage(1);
              }}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (!value) return;
              setStatusFilter(value as FollowUpStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-950" aria-label="Status">
              <SelectValue placeholder="Status">
                {(value: unknown) => resolveLabel(value, FOLLOW_UP_STATUSES, "All status")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {FOLLOW_UP_STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(value) => {
              if (!value) return;
              setPriorityFilter(value as Priority | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-950" aria-label="Priority">
              <SelectValue placeholder="Priority">
                {(value: unknown) => resolveLabel(value, FOLLOW_UP_PRIORITIES, "All priorities")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {FOLLOW_UP_PRIORITIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(value) => {
              if (!value) return;
              setTypeFilter(value as FollowUpType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-950" aria-label="Type">
              <SelectValue placeholder="Type">
                {(value: unknown) => resolveLabel(value, FOLLOW_UP_TYPES, "All types")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {FOLLOW_UP_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={clientFilter}
            onValueChange={(value) => {
              if (!value) return;
              setClientFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-950" aria-label="Client">
              <SelectValue placeholder="Client">
                {(value: unknown) =>
                  resolveLabel(
                    value,
                    clientOptions.map((c) => ({ value: c.id, label: c.label })),
                    "All clients",
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clientOptions.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={assigneeFilter}
            onValueChange={(value) => {
              if (!value) return;
              setAssigneeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-950" aria-label="Assignee">
              <SelectValue placeholder="Assignee">
                {(value: unknown) =>
                  resolveLabel(
                    value,
                    userOptions.map((u) => ({ value: u.id, label: u.label })),
                    "All assignees",
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {userOptions.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-1">
            <Label htmlFor="fu-from" className="text-xs text-muted-foreground">
              Scheduled from
            </Label>
            <Input
              id="fu-from"
              type="date"
              value={scheduledFrom}
              onChange={(e) => {
                setScheduledFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fu-to" className="text-xs text-muted-foreground">
              Scheduled to
            </Label>
            <Input
              id="fu-to"
              type="date"
              value={scheduledTo}
              onChange={(e) => {
                setScheduledTo(e.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant={overdueOnly ? "default" : "outline"}
              aria-pressed={overdueOnly}
              onClick={() => {
                setOverdueOnly((current) => !current);
                setPage(1);
              }}
              className="rounded-xl"
            >
              <AlertTriangle className="mr-2 h-4 w-4" /> Overdue only
            </Button>
            {isFiltered && (
              <Button variant="ghost" onClick={resetFilters} className="rounded-xl">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {loadState === "loading" && <TableSkeleton rows={PAGE_SIZE} />}

      {loadState === "error" && (
        <ErrorState
          title="Couldn't load follow-ups"
          description={loadErrorMessage}
          onRetry={loadFollowUps}
        />
      )}

      {loadState === "ready" && followUps.length === 0 && view === "list" && (
        <EmptyState
          icon={CalendarIcon}
          title={isFiltered ? "No follow-ups found" : "No follow-ups yet"}
          description={
            isFiltered
              ? "We couldn't find any follow-ups matching your criteria."
              : "Schedule your first follow-up to start tracking client interactions."
          }
          actionLabel={isFiltered ? undefined : "Add Follow-up"}
          onAction={isFiltered ? undefined : openCreate}
        />
      )}

      {loadState === "ready" && (
        <AnimatePresence mode="wait">
          {view === "calendar" ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-3"
            >
              <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{format(calendarMonth, "MMMM yyyy")}</h2>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous month"
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      className="h-8 w-8 rounded-xl"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next month"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      className="h-8 w-8 rounded-xl"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {calendarTruncated && (
                  <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Showing the first {followUps.length} of {total} follow-ups in this range. Narrow
                    the filters, or use the list view, to see the rest.
                  </p>
                )}

                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-muted">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="bg-slate-50 p-2 text-center text-sm font-medium text-slate-500 dark:bg-slate-950/50"
                    >
                      {day}
                    </div>
                  ))}

                  {calendarDays.map((day) => {
                    const dayFollowUps = followUpsForDate(day);
                    const isCurrentMonth = isSameMonth(day, calendarMonth);
                    const isDaySelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[100px] cursor-pointer border-t border-border/50 bg-card p-2 transition-colors
                          ${!isCurrentMonth ? "bg-muted/40 text-slate-400" : ""}
                          ${isToday(day) ? "bg-indigo-50/30 dark:bg-indigo-900/10" : ""}
                          ${
                            isDaySelected
                              ? "bg-indigo-50/50 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-900/20"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800"
                          }
                        `}
                      >
                        <div
                          className={`p-1 text-right text-sm font-medium
                            ${
                              isToday(day)
                                ? "ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white"
                                : ""
                            }
                          `}
                        >
                          {format(day, "d")}
                        </div>

                        <div className="mt-2 flex flex-col gap-1">
                          {dayFollowUps.slice(0, 3).map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center gap-1 truncate rounded bg-muted px-1.5 py-1 text-xs text-foreground"
                            >
                              <div
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOTS[f.priority]}`}
                              />
                              <span className="truncate">{f.client.companyName}</span>
                            </div>
                          ))}
                          {dayFollowUps.length > 3 && (
                            <div className="pl-1 text-xs font-medium text-slate-500">
                              +{dayFollowUps.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex h-full max-h-[800px] flex-col rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="mb-4 flex items-center text-lg font-semibold">
                  {selectedDate
                    ? isToday(selectedDate)
                      ? "Today"
                      : format(selectedDate, "MMMM d, yyyy")
                    : "Select a date"}
                </h3>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {selectedDayFollowUps.length > 0 ? (
                    selectedDayFollowUps.map((f) => {
                      const TypeIcon = TYPE_ICONS[f.type];
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => openDetail(f)}
                          className="w-full rounded-xl border bg-muted/40 p-4 text-left transition-colors hover:border-indigo-200 dark:hover:border-indigo-900"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400">
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <span className="font-semibold">{f.client.companyName}</span>
                            </div>
                            <PriorityBadge priority={f.priority} />
                          </div>
                          <p className="mb-3 text-sm text-muted-foreground">{f.subject}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(f.scheduledAt), "h:mm a")}
                            </span>
                            <StatusBadge followUp={f} />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center space-y-4 py-12 text-slate-400">
                      <CalendarIcon className="h-12 w-12 opacity-20" />
                      <p>No follow-ups for this date</p>
                      <Button variant="outline" className="rounded-xl" onClick={openCreate}>
                        Schedule one
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            followUps.length > 0 && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-muted-foreground dark:bg-slate-950/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">Client / Subject</th>
                        <th className="px-6 py-4 font-medium">Type</th>
                        <th className="px-6 py-4 font-medium">Scheduled</th>
                        <th className="px-6 py-4 font-medium">Priority</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Assigned to</th>
                        <th className="px-6 py-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {followUps.map((row) => {
                        const TypeIcon = TYPE_ICONS[row.type];
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/50 ${
                              row.isOverdue ? "bg-red-50/30 dark:bg-red-950/10" : ""
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-foreground">
                                {row.client.companyName}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">{row.subject}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 capitalize">
                                <TypeIcon className="h-4 w-4 text-slate-400" />
                                <span>{row.type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div
                                className={
                                  row.isOverdue ? "font-medium text-red-600 dark:text-red-400" : ""
                                }
                              >
                                {format(new Date(row.scheduledAt), "dd MMM yyyy")}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {format(new Date(row.scheduledAt), "h:mm a")}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <PriorityBadge priority={row.priority} />
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge followUp={row} />
                            </td>
                            <td className="px-6 py-4">
                              {row.assignedTo?.name ?? (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {row.status === "scheduled" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Mark ${row.subject} complete`}
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                    onClick={() => openComplete(row)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg p-0"
                                        aria-label={`Actions for ${row.subject}`}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => openDetail(row)}>
                                      <Eye className="mr-2 h-4 w-4" /> View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEdit(row)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    {row.status === "scheduled" && (
                                      <DropdownMenuItem onClick={() => setCancelling(row)}>
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {followUps.length} of {total} results
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      )}

      {isFormOpen && (
        <FollowUpForm
          open={isFormOpen}
          onOpenChange={(next) => {
            setIsFormOpen(next);
            if (!next) {
              setEditing(undefined);
              // Arrived via /follow-ups/new: step back to the list so the URL
              // stops describing a dialog that is no longer open.
              if (initialCreateOpen) router.replace("/follow-ups");
            }
          }}
          followUp={editing}
          onSubmit={handleSubmit}
        />
      )}

      <FollowUpDetail
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        followUp={detail}
        onEdit={openEdit}
        onComplete={openComplete}
        onCancel={setCancelling}
      />

      {/* Completing requires an outcome — the backend rejects a blank one, so
          it is collected here rather than sent empty and failed. */}
      <Dialog
        open={!!completing}
        onOpenChange={(next) => {
          if (!next && !isStatusSaving) {
            setCompleting(null);
            setStatusError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete follow-up</DialogTitle>
            <DialogDescription>
              Record what happened. This is saved as the follow-up&apos;s outcome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="fu-outcome">Outcome *</Label>
            <Textarea
              id="fu-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Client agreed to the revised pricing; sending the contract."
              rows={4}
              disabled={isStatusSaving}
              className="resize-none rounded-xl"
            />
            {statusError && <p className="text-sm text-destructive">{statusError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleting(null)}
              disabled={isStatusSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmComplete}
              disabled={outcome.trim().length === 0 || isStatusSaving}
              className="rounded-xl"
            >
              {isStatusSaving ? "Saving..." : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!cancelling}
        onOpenChange={(next) => {
          if (!next && !isStatusSaving) {
            setCancelling(null);
            setStatusError("");
          }
        }}
        title="Cancel this follow-up?"
        description={
          statusError ||
          "It will be marked as cancelled. The record and its history are kept — nothing is deleted."
        }
        confirmLabel="Cancel follow-up"
        cancelLabel="Keep it"
        variant="warning"
        loading={isStatusSaving}
        onConfirm={confirmCancel}
      />
    </motion.div>
  );
}
