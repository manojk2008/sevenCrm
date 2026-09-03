"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { combineDateAndTime } from "@/features/follow-ups/follow-up-form";
import {
  listFollowUps,
  listFollowUpStatusOptions,
  createFollowUpStatusOption,
  getFollowUpErrorMessage,
  getFollowUpStatusOptionErrorMessage,
} from "@/features/follow-ups/api";
import { ApiError } from "@/lib/api";
import type { FollowUp } from "@/types/follow-up";
import type { FollowUpStatusOption } from "@/types/follow-up-status-option";
import type { Enquiry } from "@/types/enquiry";

export interface FollowUpTransitionValues {
  /** Null when there was no active auto-managed Follow-up to close out. */
  currentFollowUpId: string | null;
  /** Always trimmed; required by the caller whenever currentFollowUpId is set. */
  currentOutcome: string;
  /** Optional organization-scoped business label — purely descriptive. */
  currentCustomStatusId: string | null;
  /** Full ISO-8601 instant, already combined from the date/time inputs. */
  nextScheduledAt: string;
  /** Optional organization-scoped business label — purely descriptive. */
  nextCustomStatusId: string | null;
}

interface FollowUpTransitionDialogProps {
  enquiry: Enquiry;
  /** Which stage is being left — determines every label below. */
  fromStage: "follow-up-1" | "follow-up-2";
  onCancel: () => void;
  /**
   * Performs the actual save sequence (close out the current Follow-up as
   * COMPLETED, then find-or-create the next one as SCHEDULED, then advance
   * the Enquiry's stage) and closes this dialog on success. The internal
   * lifecycle state is decided entirely by the caller/backend — this
   * component never collects or sends it; only the two optional
   * `customStatusId` business labels come from here. A thrown error is
   * shown inline and the dialog stays open with the user's input intact —
   * this component never advances anything itself.
   */
  onSubmit: (values: FollowUpTransitionValues) => Promise<void>;
}

function todayDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Sentinel Select value for the "+ Add option" row — never a real status id
 * (those are cuids from the database), so it can never collide with an
 * actual selection. Mirrors ADD_NEW_SOURCE_VALUE in enquiry-form.tsx.
 */
const ADD_NEW_STATUS_VALUE = "__add_new_follow_up_status__";

const STAGE_COPY = {
  "follow-up-1": { fromLabel: "Follow-up 1", toLabel: "Follow-up 2" },
  "follow-up-2": { fromLabel: "Follow-up 2", toLabel: "Follow-up 3" },
} as const;

/**
 * One "Follow-up N status" field: an organization's own customizable
 * FollowUpStatusOption list, never the fixed internal
 * scheduled/completed/cancelled values — those remain purely internal (see
 * this file's own doc comment and enquiries-content.tsx's
 * submitFollowUpTransition). Behaves like the existing Source selector in
 * enquiry-form.tsx: a trailing "+ Add option" row opens a small create
 * dialog instead of ever becoming the selected value itself.
 */
function FollowUpStatusField({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  onRequestAdd,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: FollowUpStatusOption[];
  disabled: boolean;
  onRequestAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v === ADD_NEW_STATUS_VALUE) {
            onRequestAdd();
            return;
          }
          onChange(v ?? "");
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="rounded-xl">
          <SelectValue placeholder="Select status...">
            {(v: string) => options.find((o) => o.id === v)?.name ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No follow-up statuses configured.
            </div>
          ) : (
            options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))
          )}
          <SelectSeparator />
          <SelectItem value={ADD_NEW_STATUS_VALUE}>
            <Plus className="mr-1.5 inline h-3.5 w-3.5" /> Add option
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Shown before a manual Follow-up-1 -> Follow-up-2 or Follow-up-2 ->
 * Follow-up-3 stage move (Kanban drag, or the Detail dialog's "Change
 * Stage" menu — see handleStageChange in enquiries-content.tsx) so the
 * outgoing Follow-up's outcome and the incoming one's schedule are
 * captured instead of the stage silently changing underneath them.
 *
 * IMPORTANT — internal lifecycle vs. user-facing status: the two "Follow-up
 * N status" fields below are the organization's own customizable
 * FollowUpStatusOption labels (e.g. "Customer Interested", "Demo
 * Scheduled") — never Scheduled/Completed/Cancelled, and the user is never
 * asked to choose the internal enum. That stays entirely the backend/
 * caller's responsibility: the outgoing Follow-up always becomes COMPLETED
 * (this dialog's whole purpose is "record what happened, then move on" —
 * see its title, "Complete Follow-up N") and the incoming one is always
 * created/kept SCHEDULED, exactly as the automatic sequence already does.
 * A custom status, when picked, is recorded purely as a descriptive label
 * alongside that fixed internal transition — see submitFollowUpTransition
 * in enquiries-content.tsx, which is the only place either lifecycle value
 * is actually decided.
 *
 * Self-contained data loading (mirrors EnquiryForm's own client/enquiry/
 * user/source fetch): looks up the Enquiry's current active auto-managed
 * Follow-up, via the same isAutoManaged + enquiryId + status === "scheduled"
 * identity ensureNextFollowUp uses (see follow-up-sync.ts) — never by
 * subject text — and the organization's active Follow-up statuses, in
 * parallel. If no active Follow-up is found (the Enquiry reached this stage
 * without ever going through the automatic sequence), the "what happened"
 * section is skipped entirely rather than blocking the move.
 *
 * This component only collects and validates values; the actual save
 * sequence lives in the caller's `onSubmit`, mirroring how EnquiryForm
 * collects values and defers the real API calls to its own `onSubmit` prop.
 */
export function FollowUpTransitionDialog({
  enquiry,
  fromStage,
  onCancel,
  onSubmit,
}: FollowUpTransitionDialogProps) {
  const copy = STAGE_COPY[fromStage];

  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState("");
  const [currentFollowUp, setCurrentFollowUp] = useState<FollowUp | null>(null);
  const [statusOptions, setStatusOptions] = useState<FollowUpStatusOption[]>([]);

  const [currentOutcome, setCurrentOutcome] = useState("");
  const [currentCustomStatusId, setCurrentCustomStatusId] = useState("");
  const [nextDate, setNextDate] = useState(todayDateInputValue());
  const [nextTime, setNextTime] = useState("10:00");
  const [nextCustomStatusId, setNextCustomStatusId] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // "+ Add option" dialog, shared by both status fields — routed to
  // whichever one requested it. Mirrors EnquiryForm's Add Source dialog.
  const [addStatusTarget, setAddStatusTarget] = useState<"current" | "next" | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [addStatusError, setAddStatusError] = useState("");

  // Deferred via .then() rather than calling setState directly in the effect
  // body — same react-hooks/set-state-in-effect reasoning as every other
  // data-fetch effect in this codebase (see loadEnquiries).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadState("loading");
      Promise.all([
        listFollowUps({ enquiryId: enquiry.id, isAutoManaged: true, pageSize: 100 }),
        listFollowUpStatusOptions({ status: "active" }),
      ])
        .then(([followUpResult, options]) => {
          if (cancelled) return;
          setCurrentFollowUp(followUpResult.data.find((f) => f.status === "scheduled") ?? null);
          setStatusOptions(options);
          setLoadState("ready");
        })
        .catch((error) => {
          if (cancelled) return;
          setLoadError(getFollowUpErrorMessage(error));
          setLoadState("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [enquiry.id]);

  const nextScheduledAt = combineDateAndTime(nextDate, nextTime);
  const outcomeRequired = !!currentFollowUp;
  const canSubmit =
    loadState === "ready" &&
    nextScheduledAt.length > 0 &&
    (!outcomeRequired || currentOutcome.trim().length > 0) &&
    !isSaving;

  const openAddStatus = (target: "current" | "next") => {
    setAddStatusTarget(target);
    setNewStatusName("");
    setAddStatusError("");
  };

  const handleAddStatus = async () => {
    const name = newStatusName.trim();
    if (!name || !addStatusTarget) return;
    setIsCreatingStatus(true);
    setAddStatusError("");
    try {
      const created = await createFollowUpStatusOption(name);
      setStatusOptions((prev) =>
        [...prev.filter((o) => o.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      // Automatically selected — the user never has to reopen the dropdown
      // and pick what they just typed.
      if (addStatusTarget === "current") setCurrentCustomStatusId(created.id);
      else setNextCustomStatusId(created.id);
      setAddStatusTarget(null);
      setNewStatusName("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Duplicate — re-list (in case another tab/session just created it
        // moments ago) and let the user use the existing one instead of
        // being stuck on a rejected create.
        try {
          const refreshed = await listFollowUpStatusOptions({ status: "active" });
          setStatusOptions(refreshed);
          const existing = refreshed.find((o) => o.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            if (addStatusTarget === "current") setCurrentCustomStatusId(existing.id);
            else setNextCustomStatusId(existing.id);
            setAddStatusTarget(null);
            setNewStatusName("");
            return;
          }
        } catch {
          // Fall through to showing the original error below.
        }
      }
      setAddStatusError(getFollowUpStatusOptionErrorMessage(error));
    } finally {
      setIsCreatingStatus(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await onSubmit({
        currentFollowUpId: currentFollowUp?.id ?? null,
        currentOutcome: currentOutcome.trim(),
        currentCustomStatusId: currentCustomStatusId || null,
        nextScheduledAt,
        nextCustomStatusId: nextCustomStatusId || null,
      });
      // The caller closes this dialog on success; entered values are left
      // intact here so a failure keeps the user's work (same as EnquiryForm).
    } catch (error) {
      setSaveError(getFollowUpErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(next) => !isSaving && !next && onCancel()}>
        <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete {copy.fromLabel}</DialogTitle>
            <DialogDescription>
              Record how {copy.fromLabel} went, then schedule {copy.toLabel} before moving this
              enquiry forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-1 py-2">
            {loadState === "loading" && (
              <p className="text-sm text-muted-foreground">Loading follow-up history…</p>
            )}
            {loadState === "error" && <p className="text-sm text-destructive">{loadError}</p>}

            {loadState === "ready" && currentFollowUp && (
              <div className="space-y-4 rounded-xl border p-3">
                <FollowUpStatusField
                  id="fut-current-status"
                  label={`${copy.fromLabel} Status`}
                  value={currentCustomStatusId}
                  onChange={setCurrentCustomStatusId}
                  options={statusOptions}
                  disabled={isSaving}
                  onRequestAdd={() => openAddStatus("current")}
                />

                <div className="space-y-2">
                  <Label htmlFor="fut-current-outcome">Outcome / Notes *</Label>
                  <Textarea
                    id="fut-current-outcome"
                    value={currentOutcome}
                    onChange={(e) => setCurrentOutcome(e.target.value)}
                    placeholder="How did this follow-up go?"
                    rows={3}
                    disabled={isSaving}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>
            )}

            {loadState === "ready" && !currentFollowUp && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                No active {copy.fromLabel} to record — just schedule {copy.toLabel} below.
              </p>
            )}

            {loadState === "ready" && (
              <div className="space-y-4 rounded-xl border p-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fut-next-date">{copy.toLabel} Date *</Label>
                    <Input
                      id="fut-next-date"
                      type="date"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      disabled={isSaving}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fut-next-time">{copy.toLabel} Time *</Label>
                    <Input
                      id="fut-next-time"
                      type="time"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                      disabled={isSaving}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <FollowUpStatusField
                  id="fut-next-status"
                  label={`${copy.toLabel} Status`}
                  value={nextCustomStatusId}
                  onChange={setNextCustomStatusId}
                  options={statusOptions}
                  disabled={isSaving}
                  onRequestAdd={() => openAddStatus("next")}
                />
              </div>
            )}

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSubmit} className="rounded-xl">
              {isSaving ? "Saving…" : `Save & Move to ${copy.toLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "+ Add option" — same small single-field create dialog as
          EnquiryForm's "Add source". */}
      <Dialog
        open={!!addStatusTarget}
        onOpenChange={(next) => !isCreatingStatus && !next && setAddStatusTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Follow-up Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-follow-up-status-name">Status name</Label>
            <Input
              id="new-follow-up-status-name"
              value={newStatusName}
              onChange={(e) => {
                setNewStatusName(e.target.value);
                setAddStatusError("");
              }}
              placeholder="e.g. Customer Interested"
              maxLength={100}
              disabled={isCreatingStatus}
            />
            {addStatusError && (
              <p className="text-xs text-destructive" role="alert">
                {addStatusError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddStatusTarget(null)}
              disabled={isCreatingStatus}
            >
              Cancel
            </Button>
            <Button onClick={handleAddStatus} disabled={newStatusName.trim().length === 0 || isCreatingStatus}>
              {isCreatingStatus ? "Adding…" : "Add Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
