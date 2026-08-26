"use client";

/**
 * Audit Logs — a real, read-only feed backed by GET /audit-logs (see
 * backend/src/audit-logs). Replaces the old generateMockLogs() placeholder
 * entirely: no Math.random(), no fake ids/timestamps, no fabricated
 * success messages. Visibility (organization-wide for SUPER_ADMIN/ADMIN,
 * own-actor-only for SALES_EXECUTIVE) is enforced server-side; this page
 * never filters client-side to fake that boundary.
 */
import { useEffect, useState } from "react";
import { Filter, History, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime, formatRelativeTime, getInitials } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";
import { listUsers } from "@/features/users/api";
import type { CrmUser } from "@/features/users/types";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditLogDetail, type AuditLogListItem } from "@/types/audit-log";
import { getAuditLog, getAuditLogErrorMessage, listAuditLogs } from "@/features/audit-logs/api";

type LoadState = "loading" | "error" | "ready";

const PAGE_SIZE = 15;

const ACTION_STYLES: Record<AuditAction, "success" | "info" | "warning"> = {
  create: "success",
  update: "info",
  "status-change": "warning",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  "status-change": "Status changed",
};

const ENTITY_LABELS: Record<string, string> = Object.fromEntries(
  AUDIT_ENTITY_TYPES.map((t) => [t.value, t.label]),
);

function resolveLabel(value: unknown, options: { value: string; label: string }[], fallback: string): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function ActionBadge({ action }: { action: AuditAction }) {
  return (
    <Badge variant={ACTION_STYLES[action]} className="rounded-full font-medium">
      {ACTION_LABELS[action]}
    </Badge>
  );
}

function ActorCell({ actor }: { actor: AuditLogListItem["actor"] }) {
  if (!actor) {
    return <span className="text-sm text-muted-foreground">System</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="bg-primary/10 text-[11px] text-primary">
          {getInitials(actor.name)}
        </AvatarFallback>
      </Avatar>
      <div className="leading-tight">
        <div className="text-sm font-medium">{actor.name}</div>
        <div className="text-xs text-muted-foreground">{actor.email}</div>
      </div>
    </div>
  );
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))) {
    return formatDateTime(value);
  }
  return String(value);
}

/** Union of before/after keys, before/after value pairs per key. */
function DiffTable({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No field-level changes recorded.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Before</th>
            <th className="px-3 py-2 font-medium">After</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {keys.map((key) => {
            const beforeValue = before ? before[key] : undefined;
            const afterValue = after ? after[key] : undefined;
            const changed = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
            return (
              <tr key={key} className={changed ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                <td className="px-3 py-2 font-medium text-foreground">{formatFieldName(key)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {before ? formatFieldValue(beforeValue) : <span className="italic">did not exist</span>}
                </td>
                <td className="px-3 py-2">{formatFieldValue(afterValue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditDetailSheet({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id || !open) return;
    let cancelled = false;
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously within the effect body (matches the pattern used by
    // src/features/notifications/notifications-content.tsx for the same
    // lint rule).
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setState("loading");
      setDetail(null);
      try {
        const result = await getAuditLog(id);
        if (cancelled) return;
        setDetail(result);
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getAuditLogErrorMessage(error));
        setState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Audit event detail</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {state === "loading" && (
            <div className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-20 w-full animate-pulse rounded bg-muted" />
            </div>
          )}

          {state === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}

          {state === "ready" && detail && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Action</p>
                  <ActionBadge action={detail.action} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Entity</p>
                  <p className="font-medium">{ENTITY_LABELS[detail.entityType] ?? detail.entityType}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Record</p>
                  <p className="font-medium">{detail.entityLabel ?? detail.entityId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">When</p>
                  <p className="font-medium">{formatDateTime(detail.createdAt)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Performed by</p>
                  {detail.actor ? (
                    <p className="font-medium">
                      {detail.actor.name} <span className="font-normal text-muted-foreground">({detail.actor.email})</span>
                    </p>
                  ) : (
                    <p className="font-medium text-muted-foreground">System</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">What changed</p>
                <DiffTable before={detail.before} after={detail.after} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AuditLogSettings() {
  const role = useAuthStore((state) => state.user?.role);
  const isSalesExec = role === "sales-executive";

  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [userOptions, setUserOptions] = useState<CrmUser[]>([]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const load = async () => {
    setLoadState("loading");
    try {
      const result = await listAuditLogs({
        search,
        action: actionFilter,
        entityType: entityTypeFilter,
        actorId: actorFilter !== "all" ? actorFilter : undefined,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setLogs(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setErrorMessage("");
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(getAuditLogErrorMessage(error));
      setLoadState("error");
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, actionFilter, entityTypeFilter, actorFilter, dateFrom, dateTo, page]);

  // Debounce free-text search before it drives a request; resets to page 1
  // in the same tick — mirrors follow-ups-content.tsx / quotations-content.tsx.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // The actor filter only matters for org-wide visibility (SUPER_ADMIN/
  // ADMIN) — a SALES_EXECUTIVE's view is always their own events regardless
  // of what this control shows, so it isn't rendered for that role at all.
  useEffect(() => {
    if (isSalesExec) return;
    let cancelled = false;
    listUsers()
      .then((users) => {
        if (!cancelled) setUserOptions(users);
      })
      .catch(() => {
        // Silent — the actor filter simply stays empty, same convention as
        // follow-ups-content.tsx's client/user filter options.
      });
    return () => {
      cancelled = true;
    };
  }, [isSalesExec]);

  const isFiltered =
    !!search || actionFilter !== "all" || entityTypeFilter !== "all" || actorFilter !== "all" || !!dateFrom || !!dateTo;

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setActionFilter("all");
    setEntityTypeFilter("all");
    setActorFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openDetail = (row: AuditLogListItem) => {
    setDetailId(row.id);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">
            {isSalesExec
              ? "Your own record of created, updated, and status-changed CRM records."
              : "Organization-wide record of who created, updated, or changed the status of CRM records."}
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by record or person..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-xl pl-8"
          />
        </div>

        <div className={`grid gap-3 sm:grid-cols-2 ${isSalesExec ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              if (!value) return;
              setActionFilter(value as AuditAction | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl" aria-label="Action">
              <SelectValue placeholder="Action">
                {(value: unknown) => resolveLabel(value, AUDIT_ACTIONS, "All actions")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entityTypeFilter}
            onValueChange={(value) => {
              if (!value) return;
              setEntityTypeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl" aria-label="Entity">
              <SelectValue placeholder="Entity">
                {(value: unknown) => resolveLabel(value, AUDIT_ENTITY_TYPES, "All entities")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {AUDIT_ENTITY_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isSalesExec && (
            <Select
              value={actorFilter}
              onValueChange={(value) => {
                if (!value) return;
                setActorFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="rounded-xl" aria-label="Person">
                <SelectValue placeholder="Person">
                  {(value: unknown) =>
                    resolveLabel(
                      value,
                      userOptions.map((u) => ({ value: u.id, label: u.name })),
                      "All people",
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                {userOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="audit-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-xl"
            />
          </div>
        </div>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="rounded-xl">
            <Filter className="mr-2 h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {loadState === "loading" && <TableSkeleton rows={PAGE_SIZE} />}

      {loadState === "error" && <ErrorState title="Couldn't load audit logs" description={errorMessage} onRetry={load} />}

      {loadState === "ready" && logs.length === 0 && (
        <EmptyState
          icon={History}
          title={isFiltered ? "No matching audit events" : "No audit events yet"}
          description={
            isFiltered
              ? "We couldn't find any audit events matching your criteria."
              : "Audit events appear here as records are created, updated, or change status."
          }
        />
      )}

      {loadState === "ready" && logs.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(log)}
                >
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelativeTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ActorCell actor={log.actor} />
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell className="text-sm">{ENTITY_LABELS[log.entityType] ?? log.entityType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.entityLabel ?? log.entityId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Showing {logs.length} of {total} results
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
        </div>
      )}

      <AuditDetailSheet
        id={detailId}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}
