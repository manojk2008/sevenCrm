"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { EnquiryForm } from "./enquiry-form";
import { EnquiryDetail } from "./enquiry-detail";
import { ensureNextFollowUp } from "./follow-up-sync";
import {
  FollowUpTransitionDialog,
  type FollowUpTransitionValues,
} from "./follow-up-transition-dialog";
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
  deleteEnquiry,
  getEnquiryErrorMessage,
  type EnquiryFormValues,
} from "./api";
import {
  listFollowUps,
  updateFollowUp,
  updateFollowUpStatus,
  createAutoManagedFollowUp,
} from "@/features/follow-ups/api";
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

const ENQUIRY_STAGE_VALUES = new Set(ENQUIRY_STAGES.map((s) => s.key));

function isEnquiryStage(value: string | null): value is EnquiryStage {
  return value !== null && ENQUIRY_STAGE_VALUES.has(value as EnquiryStage);
}

export function EnquiriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  // UX gating only — the backend (SUPER_ADMIN/ADMIN on every delete) remains
  // the actual authorization boundary, same pattern as ProductsContent's
  // canManage.
  const canDelete = currentUser?.role === "super-admin" || currentUser?.role === "admin";

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
  // Seeded from `?stage=` when present and valid (e.g. the Dashboard's
  // "Succeeded Enquiries" KPI card links to `/enquiries?stage=won` — the
  // wire value stays "won", only the display label reads "Succeed") — falls
  // back to the existing unfiltered default otherwise. Read once via a lazy
  // initializer; the existing Filter dropdown is the only way to change it
  // afterward.
  const [stageFilter, setStageFilter] = useState<EnquiryStage | undefined>(() => {
    const param = searchParams.get("stage");
    return isEnquiryStage(param) ? param : undefined;
  });
  const [priorityFilter, setPriorityFilter] = useState<Priority | undefined>(undefined);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");

  // Pending LOST (displayed as "Failed") transition awaiting a reason.
  // `previousStage` is what the card is rolled back to if the user cancels
  // or the request fails.
  const [pendingLost, setPendingLost] = useState<
    { id: string; previousStage: EnquiryStage } | null
  >(null);
  const [lostReasonInput, setLostReasonInput] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);

  // Pending Follow-up-1->2 / Follow-up-2->3 transition awaiting the
  // FollowUpTransitionDialog. Same rollback contract as pendingLost:
  // `previousStage` is what the card is rolled back to on Cancel/failure.
  const [pendingFollowUpTransition, setPendingFollowUpTransition] = useState<
    { enquiry: Enquiry; fromStage: "follow-up-1" | "follow-up-2"; previousStage: EnquiryStage } | null
  >(null);

  const [enquiryToDelete, setEnquiryToDelete] = useState<Enquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  // Extracted from the card-click handler below so the `?enquiryId=` deep
  // link (a Follow-up detail's "View Enquiry" link) can open the same way.
  const openEnquiryById = useCallback(
    async (id: string) => {
      if (loadingEnquiryId) return;
      setLoadingEnquiryId(id);
      try {
        const full = await getEnquiry(id);
        setSelectedEnquiry(full);
        setIsDetailOpen(true);
      } catch (error) {
        handleApiError(error, "Couldn't load that enquiry.");
      } finally {
        setLoadingEnquiryId(null);
      }
    },
    [loadingEnquiryId, handleApiError],
  );

  const handleEnquiryClick = (enquiry: Enquiry) => openEnquiryById(enquiry.id);

  // Opens the linked Enquiry directly when arriving via `?enquiryId=` (a
  // Follow-up detail's "View Enquiry" link) — mirrors the existing `?stage=`
  // param precedent above. Read once via a ref guard, not the initializer
  // pattern `stageFilter` uses, because opening a dialog is an action (not a
  // filter default) and must not repeat on every re-render or after the
  // user closes the dialog themselves.
  const openedFromEnquiryIdParam = useRef(false);
  useEffect(() => {
    if (openedFromEnquiryIdParam.current) return;
    const id = searchParams.get("enquiryId");
    if (!id) return;
    openedFromEnquiryIdParam.current = true;
    // Deferred via .then() rather than called directly — calling a function
    // that sets state as a bare statement in an effect body runs its
    // setState synchronously within the effect's own flush, which is what
    // react-hooks/set-state-in-effect flags. Same pattern as loadEnquiries
    // below.
    Promise.resolve().then(() => openEnquiryById(id));
  }, [searchParams, openEnquiryById]);

  const handleSubmitForm = async (values: EnquiryFormValues) => {
    if (editingEnquiry) {
      const updated = await updateEnquiry(editingEnquiry.id, values);
      setIsFormOpen(false);
      setEditingEnquiry(undefined);
      toast.success("Enquiry updated");
      // Keeps the Enquiry's Next Follow-up in sync — never a duplicate, see
      // ensureNextFollowUp's own doc comment. Run after the success toast so
      // a sync failure's warning reads as a follow-on, not a contradiction.
      // Its return value (possibly stage-advanced — see follow-up-sync.ts)
      // is what local state is updated from, not the pre-sync `updated`, so
      // an open detail dialog reflects an automatic Follow-up 1->2/2->3
      // stage advance immediately rather than only after a reload.
      const synced = await ensureNextFollowUp(updated);
      if (selectedEnquiry?.id === synced.id) setSelectedEnquiry(synced);
      await loadEnquiries();
      return;
    }

    const created = await createEnquiry(values);
    setIsFormOpen(false);
    toast.success("Enquiry created");
    // Automatic Next Follow-up, created directly and sequentially right
    // after the Enquiry — never in a useEffect, so it can't re-fire just
    // because an enquiry exists. A failure here must not be mistaken for
    // the Enquiry itself failing: it already exists, so this is reported as
    // its own warning rather than swallowed or retried (see
    // ensureNextFollowUp).
    await ensureNextFollowUp(created);
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
      // LOST (displayed as "Failed") needs a reason before the request can
      // be made at all — the backend rejects a blank one, so collect it
      // first.
      if (newStage === "lost") {
        setLostReasonInput("");
        setPendingLost({ id, previousStage });
        return;
      }
      // Follow-up-1 -> Follow-up-2 and Follow-up-2 -> Follow-up-3 need the
      // outgoing Follow-up's outcome and the incoming one's schedule before
      // the stage actually moves — same "collect first" shape as LOST above.
      const isFollowUpAdvance =
        (previousStage === "follow-up-1" && newStage === "follow-up-2") ||
        (previousStage === "follow-up-2" && newStage === "follow-up-3");
      if (isFollowUpAdvance) {
        const enquiry =
          selectedEnquiry?.id === id ? selectedEnquiry : enquiries.find((e) => e.id === id);
        if (enquiry) {
          setPendingFollowUpTransition({
            enquiry,
            fromStage: previousStage as "follow-up-1" | "follow-up-2",
            previousStage,
          });
          return;
        }
      }
      void persistStageChange(id, newStage, previousStage);
    },
    [persistStageChange, enquiries, selectedEnquiry],
  );

  const cancelLostTransition = () => {
    if (!pendingLost) return;
    setEnquiries((prev) =>
      prev.map((e) => (e.id === pendingLost.id ? { ...e, stage: pendingLost.previousStage } : e)),
    );
    setPendingLost(null);
    setLostReasonInput("");
  };

  // Rolls the card back to its pre-drag stage — mirrors cancelLostTransition
  // exactly. Used both for an explicit Cancel and for the dialog's own
  // backdrop/Esc dismissal (guarded by isSaving inside the dialog itself).
  const cancelFollowUpTransition = () => {
    if (!pendingFollowUpTransition) return;
    const { enquiry, previousStage } = pendingFollowUpTransition;
    setEnquiries((prev) =>
      prev.map((e) => (e.id === enquiry.id ? { ...e, stage: previousStage } : e)),
    );
    setPendingFollowUpTransition(null);
  };

  /**
   * The actual save sequence for a Follow-up-stage transition, run in this
   * strict order so the Enquiry's stage only ever moves after both
   * Follow-up writes succeed. This is also the ONLY place either internal
   * lifecycle value is decided — FollowUpTransitionDialog never collects or
   * sends `status`, only the two optional, purely-descriptive
   * `customStatusId` business labels:
   *
   *  1. Close out the outgoing Follow-up (if one was found) as COMPLETED —
   *     fixed, not a user choice: this dialog's whole purpose is "record
   *     what happened, then move on" (see its title, "Complete Follow-up
   *     N"). Uses the same PATCH /follow-ups/:id/status the ordinary
   *     Complete/Cancel actions on the Follow-ups page use, with the
   *     existing outcome-required-on-COMPLETED validation intact.
   *  2. Find-or-create the incoming Follow-up using the exact identity
   *     convention ensureNextFollowUp uses (isAutoManaged + enquiryId +
   *     status === "scheduled", never subject text) — re-checked here rather
   *     than trusting what the dialog saw on open, so a concurrent change
   *     can never produce a duplicate scheduled auto-managed Follow-up. It
   *     is always left SCHEDULED (create's own default; update never
   *     touches status) — again fixed, never a user choice.
   *  3. Advance the stage.
   *
   * A failure at any step throws back to the dialog (which shows it inline
   * and keeps the user's input) and this function never reaches the stage
   * update — the Kanban card stays wherever the dialog's own Cancel/failure
   * path rolls it back to.
   */
  const submitFollowUpTransition = async (values: FollowUpTransitionValues) => {
    if (!pendingFollowUpTransition) return;
    const { enquiry, fromStage } = pendingFollowUpTransition;
    const toStage = fromStage === "follow-up-1" ? "follow-up-2" : "follow-up-3";

    if (values.currentFollowUpId) {
      await updateFollowUpStatus(
        values.currentFollowUpId,
        "completed",
        values.currentOutcome,
        values.currentCustomStatusId ?? undefined,
      );
    }

    const subject = `Follow up: ${enquiry.title}`;
    const existing = await listFollowUps({
      enquiryId: enquiry.id,
      isAutoManaged: true,
      pageSize: 100,
    });
    const stillScheduled = existing.data.find((f) => f.status === "scheduled");

    if (stillScheduled) {
      await updateFollowUp(stillScheduled.id, {
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        assignedToId: enquiry.assignedTo || "",
        subject,
        description: stillScheduled.description ?? "",
        type: stillScheduled.type,
        priority: enquiry.priority,
        scheduledAt: values.nextScheduledAt,
        notes: stillScheduled.notes ?? "",
        reminder: stillScheduled.reminder,
        customStatusId: values.nextCustomStatusId ?? "",
      });
    } else {
      await createAutoManagedFollowUp({
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        assignedToId: enquiry.assignedTo || "",
        subject,
        description: "",
        type: "call",
        priority: enquiry.priority,
        scheduledAt: values.nextScheduledAt,
        notes: "",
        reminder: false,
        customStatusId: values.nextCustomStatusId ?? undefined,
      });
    }

    const updated = await updateEnquiryStage(enquiry.id, toStage);
    setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedEnquiry((prev) => (prev?.id === updated.id ? updated : prev));
    setPendingFollowUpTransition(null);
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
      handleApiError(error, "Couldn't mark that enquiry as failed.");
    } finally {
      setIsSavingStage(false);
    }
  };

  const handleDelete = async () => {
    if (!enquiryToDelete) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteEnquiry(enquiryToDelete.id);
      toast.success(`${enquiryToDelete.title} has been permanently deleted`);
      setEnquiries((prev) => prev.filter((e) => e.id !== enquiryToDelete.id));
      setEnquiryToDelete(null);
      // Close the detail dialog if the deleted enquiry is the one open.
      if (selectedEnquiry?.id === enquiryToDelete.id) {
        setIsDetailOpen(false);
        setSelectedEnquiry(null);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      // Keep the enquiry and the dialog usable rather than closing on error.
      setDeleteError(getEnquiryErrorMessage(error));
    } finally {
      setIsDeleting(false);
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
        onDelete={(enquiry) => {
          setDeleteError("");
          setEnquiryToDelete(enquiry);
        }}
        canDelete={canDelete}
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

      {/* Moving a card to Failed (internal stage: LOST) needs a reason: the
          API requires a non-blank lostReason for that transition and rejects
          the request without one. */}
      <AlertDialog
        open={!!pendingLost}
        onOpenChange={(open) => !open && !isSavingStage && cancelLostTransition()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this enquiry as failed?</AlertDialogTitle>
            <AlertDialogDescription>
              Record why this enquiry failed. You can move it back to another stage later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lost-reason">Reason for failure *</Label>
            <Textarea
              id="lost-reason"
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              placeholder="Why did this enquiry fail?"
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
              {isSavingStage ? "Saving…" : "Mark as failed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Follow-up-1 -> 2 / Follow-up-2 -> 3: collects the outgoing
          Follow-up's outcome and the incoming one's schedule before the
          stage actually moves. Mounted only while pending, same convention
          as EnquiryForm above. */}
      {pendingFollowUpTransition && (
        <FollowUpTransitionDialog
          enquiry={pendingFollowUpTransition.enquiry}
          fromStage={pendingFollowUpTransition.fromStage}
          onCancel={cancelFollowUpTransition}
          onSubmit={submitFollowUpTransition}
        />
      )}

      {/* Delete Confirmation. The description makes the FK-safe but
          user-visible consequence explicit: quotations/follow-ups raised
          from this enquiry are never deleted, only unlinked. */}
      <ConfirmationDialog
        open={!!enquiryToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setEnquiryToDelete(null);
            setDeleteError("");
          }
        }}
        title="Delete this enquiry?"
        description={
          deleteError ||
          `Are you sure you want to permanently delete "${enquiryToDelete?.title}"? Related quotations and follow-ups will remain but will no longer be linked to this enquiry.`
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
