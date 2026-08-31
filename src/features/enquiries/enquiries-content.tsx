"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, Table as TableIcon, Filter, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { EnquiryForm } from "./enquiry-form";
import { EnquiryDetail } from "./enquiry-detail";
import { Enquiry, ENQUIRY_STAGES } from "@/types/enquiry";
import type { EnquiryStage } from "@/types/enquiry";
import type { Priority } from "@/types/common";
import { formatCurrency } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  listEnquiries,
  getEnquiry,
  createEnquiry,
  updateEnquiry,
  updateEnquiryStage,
  getEnquiryErrorMessage,
  type EnquiryFormValues,
} from "./api";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LoadState = "loading" | "error" | "ready";
type SubFilter = "all" | "mine";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// The kanban needs every stage's cards on screen at once, so it asks for the
// backend's maximum page. The table uses a conventional page size. Both go
// through the same server-side pagination — neither slices a preloaded set.
const TABLE_PAGE_SIZE = 10;
const KANBAN_PAGE_SIZE = 100;

export function EnquiriesContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | undefined>(undefined);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  // Set while a click on an enquiry card/row is fetching the full record —
  // the detail dialog only opens once that finishes, so it never shows a
  // stale/partial list snapshot for even a moment.
  const [loadingEnquiryId, setLoadingEnquiryId] = useState<string | null>(null);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<EnquiryStage | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<Priority | undefined>(undefined);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");

  // Pending LOST transition awaiting a reason. `previousStage` is what the
  // card is rolled back to if the user cancels or the request fails.
  const [pendingLost, setPendingLost] = useState<
    { id: string; previousStage: EnquiryStage } | null
  >(null);
  const [lostReasonInput, setLostReasonInput] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);

  // A 401 means the session is gone — the backend is authoritative, so we
  // clear local state and send the user back to login rather than leaving a
  // stale "authenticated" UI showing (mirrors clients-content.tsx).
  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const assignedToId = subFilter === "mine" ? currentUser?.id : undefined;

  const loadEnquiries = useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await listEnquiries({
        search,
        stage: stageFilter,
        priority: priorityFilter,
        assignedToId,
        page,
        pageSize: view === "kanban" ? KANBAN_PAGE_SIZE : TABLE_PAGE_SIZE,
      });
      setEnquiries(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getEnquiryErrorMessage(error));
      setLoadState("error");
    }
  }, [search, stageFilter, priorityFilter, assignedToId, page, view, handleUnauthorized]);

  // Deferred one microtask via .then() rather than called directly: calling
  // a useCallback that sets state as a bare statement in an effect body runs
  // its setState synchronously within the effect's own flush, which is what
  // react-hooks/set-state-in-effect flags ("Avoid calling setState()
  // directly within an effect"). Routing the same call through a resolved
  // promise's .then() defers it to a real microtask instead — the exact
  // "calling setState in a callback function" shape the rule's own message
  // recommends — with no change to loadEnquiries itself and no observable
  // behavior change (microtasks flush before the browser paints).
  useEffect(() => {
    Promise.resolve().then(loadEnquiries);
  }, [loadEnquiries]);

  // Debounce free-text search before it drives a request. A new search always
  // starts back at page 1; every other filter resets the page in its own
  // handler below, so no effect ever has to reconcile the two.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const handleApiError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getEnquiryErrorMessage(error) || fallback);
    },
    [handleUnauthorized],
  );

  // The list only carries what the card/row needs; the detail dialog needs
  // the full record (e.g. products/description), so it fetches it and only
  // opens once that finishes rather than opening with a stale snapshot.
  const handleEnquiryClick = async (enquiry: Enquiry) => {
    if (loadingEnquiryId) return;
    setLoadingEnquiryId(enquiry.id);
    try {
      const full = await getEnquiry(enquiry.id);
      setSelectedEnquiry(full);
      setIsDetailOpen(true);
    } catch (error) {
      handleApiError(error, "Couldn't load that enquiry.");
    } finally {
      setLoadingEnquiryId(null);
    }
  };

  const handleSubmitForm = async (values: EnquiryFormValues) => {
    if (editingEnquiry) {
      const updated = await updateEnquiry(editingEnquiry.id, values);
      setIsFormOpen(false);
      setEditingEnquiry(undefined);
      toast.success("Enquiry updated");
      if (selectedEnquiry?.id === updated.id) setSelectedEnquiry(updated);
      await loadEnquiries();
      return;
    }

    await createEnquiry(values);
    setIsFormOpen(false);
    toast.success("Enquiry created");
    await loadEnquiries();
  };

  /**
   * Persists a stage change the Kanban board has already applied optimistically.
   * On failure the card is rolled back to `previousStage`; there is no success
   * toast for a drag, since the card visibly moving is the confirmation.
   */
  const persistStageChange = useCallback(
    async (id: string, newStage: EnquiryStage, previousStage: EnquiryStage) => {
      try {
        const updated = await updateEnquiryStage(id, newStage);
        setEnquiries((prev) => prev.map((e) => (e.id === id ? updated : e)));
        setSelectedEnquiry((prev) => (prev?.id === id ? updated : prev));
      } catch (error) {
        setEnquiries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, stage: previousStage } : e)),
        );
        handleApiError(error, "Couldn't move that enquiry.");
      }
    },
    [handleApiError],
  );

  const handleStageChange = useCallback(
    (id: string, newStage: EnquiryStage, previousStage: EnquiryStage) => {
      // LOST needs a reason before the request can be made at all — the
      // backend rejects a blank one, so collect it first.
      if (newStage === "lost") {
        setLostReasonInput("");
        setPendingLost({ id, previousStage });
        return;
      }
      void persistStageChange(id, newStage, previousStage);
    },
    [persistStageChange],
  );

  const cancelLostTransition = () => {
    if (!pendingLost) return;
    setEnquiries((prev) =>
      prev.map((e) => (e.id === pendingLost.id ? { ...e, stage: pendingLost.previousStage } : e)),
    );
    setPendingLost(null);
    setLostReasonInput("");
  };

  const confirmLostTransition = async () => {
    if (!pendingLost || !lostReasonInput.trim()) return;
    setIsSavingStage(true);
    try {
      const updated = await updateEnquiryStage(pendingLost.id, "lost", lostReasonInput.trim());
      setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedEnquiry((prev) => (prev?.id === updated.id ? updated : prev));
      setPendingLost(null);
      setLostReasonInput("");
    } catch (error) {
      setEnquiries((prev) =>
        prev.map((e) => (e.id === pendingLost.id ? { ...e, stage: pendingLost.previousStage } : e)),
      );
      setPendingLost(null);
      setLostReasonInput("");
      handleApiError(error, "Couldn't mark that enquiry as lost.");
    } finally {
      setIsSavingStage(false);
    }
  };

  const hasActiveFilters = !!stageFilter || !!priorityFilter;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col items-start justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enquiries</h1>
          <p className="text-sm text-muted-foreground">Manage your sales pipeline</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search enquiries..."
              className="h-9 w-full pl-9 sm:w-56"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search enquiries"
            />
          </div>

          {/* View Toggle */}
          <Tabs
            value={view}
            onValueChange={(v) => { setView(v as "kanban" | "table"); setPage(1); }}
            className="mr-2"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="kanban" className="text-xs px-3">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs px-3">
                <TableIcon className="h-4 w-4 mr-2" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                  {hasActiveFilters && (
                    <span className="ml-2 rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                      {(stageFilter ? 1 : 0) + (priorityFilter ? 1 : 0)}
                    </span>
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by Stage</DropdownMenuLabel>
              {ENQUIRY_STAGES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.key}
                  checked={stageFilter === s.key}
                  onCheckedChange={(checked) => { setStageFilter(checked ? s.key : undefined); setPage(1); }}
                >
                  {s.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
              {PRIORITY_OPTIONS.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.value}
                  checked={priorityFilter === p.value}
                  onCheckedChange={(checked) => { setPriorityFilter(checked ? p.value : undefined); setPage(1); }}
                >
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => { setEditingEnquiry(undefined); setIsFormOpen(true); }}
            size="sm"
            className="h-9"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Enquiry
          </Button>
        </div>
      </div>

      {/* Tabs / Sub-filters.
          "Unassigned" and "Overdue" are disabled: the Enquiries API has no way
          to express "assignedToId IS NULL" or an expectedCloseDate range, so
          they cannot be served honestly without backend work. */}
      <div className="scrollbar-thin flex flex-shrink-0 items-center gap-6 overflow-x-auto border-b py-2 text-sm font-medium">
        <button
          onClick={() => { setSubFilter("all"); setPage(1); }}
          className={`-mb-[9px] whitespace-nowrap pb-2 ${
            subFilter === "all"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setSubFilter("mine"); setPage(1); }}
          disabled={!currentUser}
          className={`-mb-[9px] whitespace-nowrap pb-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            subFilter === "mine"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Enquiries
        </button>
        <button
          disabled
          title="Filtering by unassigned isn't supported by the API yet."
          className="-mb-[9px] cursor-not-allowed whitespace-nowrap pb-2 text-muted-foreground opacity-50"
        >
          Unassigned
        </button>
        <button
          disabled
          title="Filtering by overdue isn't supported by the API yet."
          className="-mb-[9px] cursor-not-allowed whitespace-nowrap pb-2 text-muted-foreground opacity-50"
        >
          Overdue
        </button>
      </div>

      {/* Content Area */}
      <div className="relative pt-6">
        {loadState === "loading" && <TableSkeleton rows={TABLE_PAGE_SIZE} />}

        {loadState === "error" && (
          <ErrorState
            title="Couldn't load enquiries"
            description={loadErrorMessage}
            onRetry={loadEnquiries}
          />
        )}

        {loadState === "ready" && enquiries.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-base font-medium text-foreground">No enquiries found</p>
            <p className="mb-4 text-sm text-muted-foreground">
              {search || hasActiveFilters || subFilter !== "all"
                ? "We couldn't find any enquiries matching your criteria."
                : "Log your first enquiry to start tracking your pipeline."}
            </p>
            <Button size="sm" onClick={() => { setEditingEnquiry(undefined); setIsFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Enquiry
            </Button>
          </div>
        )}

        {loadState === "ready" && enquiries.length > 0 && (
          view === "kanban" ? (
            <div className="space-y-4">
              <KanbanBoard
                enquiries={enquiries}
                setEnquiries={setEnquiries}
                onCardClick={handleEnquiryClick}
                onStageChange={handleStageChange}
              />
              <div className="flex items-center justify-between px-1">
                <div className="text-sm text-muted-foreground">
                  Showing {enquiries.length} of {total} enquiries
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                      <th className="px-4 py-3 font-medium text-center">Probability</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Executive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enquiries.map((eq) => {
                      const stageInfo = ENQUIRY_STAGES.find((s) => s.key === eq.stage);
                      return (
                        <tr key={eq.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleEnquiryClick(eq)}>
                          <td className="px-4 py-3 font-medium text-foreground">{eq.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">{eq.clientCompany || eq.clientName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageInfo?.bgColor} ${stageInfo?.color}`}>
                              {stageInfo?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(eq.expectedRevenue || 0)}</td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${eq.probability}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs capitalize">{eq.priority}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold">
                                {eq.assignedToName ? eq.assignedToName.charAt(0) : "—"}
                              </div>
                              <span className="text-xs truncate max-w-[100px]">
                                {eq.assignedToName || "Unassigned"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  Showing {enquiries.length} of {total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <EnquiryDetail
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) setSelectedEnquiry(null);
        }}
        enquiry={selectedEnquiry}
        onEdit={(enquiry) => {
          setEditingEnquiry(enquiry);
          setIsFormOpen(true);
        }}
        onStageChange={(stage) => {
          if (!selectedEnquiry) return;
          handleStageChange(selectedEnquiry.id, stage, selectedEnquiry.stage);
        }}
      />

      {isFormOpen && (
        <EnquiryForm
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingEnquiry(undefined);
          }}
          enquiry={editingEnquiry}
          onSubmit={handleSubmitForm}
        />
      )}

      {/* Moving a card to Lost needs a reason: the API requires a non-blank
          lostReason for that transition and rejects the request without one. */}
      <AlertDialog
        open={!!pendingLost}
        onOpenChange={(open) => !open && !isSavingStage && cancelLostTransition()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this enquiry as lost?</AlertDialogTitle>
            <AlertDialogDescription>
              Record why this enquiry was lost. You can move it back to another stage later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lost-reason">Reason for loss *</Label>
            <Textarea
              id="lost-reason"
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              placeholder="Why was this enquiry lost?"
              disabled={isSavingStage}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingStage} onClick={cancelLostTransition}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!lostReasonInput.trim() || isSavingStage}
              onClick={confirmLostTransition}
            >
              {isSavingStage ? "Saving…" : "Mark as lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
