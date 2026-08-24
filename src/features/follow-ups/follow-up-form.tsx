"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listClients } from "@/features/clients/api";
import { listEnquiries } from "@/features/enquiries/api";
import { listUsers } from "@/features/users/api";
import {
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_TYPES,
  type FollowUp,
  type FollowUpType,
} from "@/types/follow-up";
import type { Priority } from "@/types/common";
import type { FollowUpFormValues } from "./api";

interface ClientOption {
  id: string;
  label: string;
}

interface EnquiryOption {
  id: string;
  clientId: string;
  label: string;
}

interface UserOption {
  id: string;
  label: string;
}

interface FollowUpFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  followUp?: FollowUp;
  onSubmit: (values: FollowUpFormValues) => Promise<void>;
}

/**
 * The backend stores one `scheduledAt` instant. The form collects it as a
 * date and a time because that is how people think about scheduling — these
 * two helpers are the only place the two representations meet, and they are
 * exact inverses of each other in the browser's local timezone.
 */
function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toTimeInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Combines the date and time inputs into the single ISO-8601 instant the
 * backend's `scheduledAt` expects. Built through the local-time `Date`
 * constructor (not string concatenation) so "14:00" means 2pm where the user
 * is, and returns "" for an incomplete pair so the caller can refuse to save.
 */
export function combineDateAndTime(date: string, time: string): string {
  if (!date || !time) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) return "";
  const combined = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(combined.getTime()) ? "" : combined.toISOString();
}

/**
 * Base UI's <Select.Value> renders the raw `value` unless it is given a render
 * function — which would put a bare cuid in the trigger instead of the client's
 * name. Every select below therefore resolves its own label from the option
 * list it was built from.
 */
function resolveLabel(
  value: unknown,
  options: { value: string; label: string }[],
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function FollowUpForm({ open, onOpenChange, followUp, onSubmit }: FollowUpFormProps) {
  const isEdit = !!followUp;

  // The parent renders this component only while the dialog is open, so it
  // remounts on every open — prefilling from props here is enough, and avoids
  // a reset effect (same convention as EnquiryForm).
  const [clientId, setClientId] = useState(followUp?.clientId ?? "");
  const [enquiryId, setEnquiryId] = useState(followUp?.enquiryId ?? "");
  const [assignedToId, setAssignedToId] = useState(followUp?.assignedToId ?? "");
  const [subject, setSubject] = useState(followUp?.subject ?? "");
  const [description, setDescription] = useState(followUp?.description ?? "");
  const [type, setType] = useState<FollowUpType>(followUp?.type ?? "call");
  const [priority, setPriority] = useState<Priority>(followUp?.priority ?? "medium");
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue(followUp?.scheduledAt));
  const [scheduledTime, setScheduledTime] = useState(
    followUp ? toTimeInputValue(followUp.scheduledAt) : "10:00",
  );
  const [notes, setNotes] = useState(followUp?.notes ?? "");
  const [reminder, setReminder] = useState(followUp?.reminder ?? false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Real Clients/Enquiries/Users data — no mock lists, and each feature's own
  // API module is the single source for its own records.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const [clientResult, enquiryResult, userResult] = await Promise.all([
          listClients({ status: "active", pageSize: 100 }),
          listEnquiries({ pageSize: 100 }),
          listUsers(),
        ]);
        if (cancelled) return;
        setClients(clientResult.data.map((c) => ({ id: c.id, label: c.name })));
        setEnquiries(
          enquiryResult.data.map((e) => ({ id: e.id, clientId: e.clientId, label: e.title })),
        );
        setUsers(userResult.map((u) => ({ id: u.id, label: u.name })));
        setOptionsError("");
      } catch {
        if (cancelled) return;
        setOptionsError("Couldn't load clients, enquiries and users. Close and reopen to retry.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Only the selected client's enquiries are offered. The backend enforces the
  // same rule (an enquiry belonging to a different client is a 400), so this
  // is a convenience, not the security boundary.
  const enquiriesForClient = useMemo(
    () => (clientId ? enquiries.filter((enquiry) => enquiry.clientId === clientId) : []),
    [clientId, enquiries],
  );

  const scheduledAt = combineDateAndTime(scheduledDate, scheduledTime);

  const canSubmit =
    clientId.length > 0 && subject.trim().length > 0 && scheduledAt.length > 0 && !isSaving;

  /**
   * Changing the client invalidates any enquiry chosen under the previous
   * one, so the selection is cleared rather than left to be rejected by the
   * backend on save.
   */
  const handleClientChange = (nextClientId: string) => {
    setClientId(nextClientId);
    if (nextClientId !== clientId) setEnquiryId("");
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setFormError("");
    try {
      await onSubmit({
        clientId,
        enquiryId,
        assignedToId,
        subject: subject.trim(),
        description: description.trim(),
        type,
        priority,
        scheduledAt,
        notes: notes.trim(),
        reminder,
      });
      // The parent closes the dialog on success; entered values are left
      // intact here so a failure keeps the user's work.
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save the follow-up.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit follow-up" : "Schedule follow-up"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this follow-up's details."
              : "Plan your next interaction with a client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1 py-4">
          {optionsError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {optionsError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fu-client">Client *</Label>
              <Select
                value={clientId}
                onValueChange={(value) => value && handleClientChange(value)}
                disabled={isSaving || isEdit}
              >
                <SelectTrigger id="fu-client" className="rounded-xl">
                  <SelectValue placeholder="Select client">
                    {(value: unknown) =>
                      resolveLabel(
                        value,
                        clients.map((c) => ({ value: c.id, label: c.label })),
                        "Select client",
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  A follow-up can&apos;t be moved to a different client.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-enquiry">Related enquiry</Label>
              <Select
                value={enquiryId || "none"}
                onValueChange={(value) => value && setEnquiryId(value === "none" ? "" : value)}
                disabled={isSaving || !clientId}
              >
                <SelectTrigger id="fu-enquiry" className="rounded-xl">
                  <SelectValue placeholder={clientId ? "None" : "Select a client first"}>
                    {(value: unknown) =>
                      resolveLabel(
                        value,
                        enquiriesForClient.map((e) => ({ value: e.id, label: e.label })),
                        "None",
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {enquiriesForClient.map((enquiry) => (
                    <SelectItem key={enquiry.id} value={enquiry.id}>
                      {enquiry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientId && enquiriesForClient.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This client has no enquiries to link.
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fu-subject">Subject *</Label>
              <Input
                id="fu-subject"
                placeholder="e.g. Discuss the revised pricing proposal"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-type">Type *</Label>
              <Select
                value={type}
                onValueChange={(value) => value && setType(value as FollowUpType)}
                disabled={isSaving}
              >
                <SelectTrigger id="fu-type" className="rounded-xl">
                  <SelectValue placeholder="Select type">
                    {(value: unknown) => resolveLabel(value, FOLLOW_UP_TYPES, "Select type")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-priority">Priority *</Label>
              <Select
                value={priority}
                onValueChange={(value) => value && setPriority(value as Priority)}
                disabled={isSaving}
              >
                <SelectTrigger id="fu-priority" className="rounded-xl">
                  <SelectValue placeholder="Select priority">
                    {(value: unknown) => resolveLabel(value, FOLLOW_UP_PRIORITIES, "Select priority")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_PRIORITIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-date">Date *</Label>
              <Input
                id="fu-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-time">Time *</Label>
              <Input
                id="fu-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fu-assignee">Assigned to</Label>
              <Select
                value={assignedToId || "none"}
                onValueChange={(value) => value && setAssignedToId(value === "none" ? "" : value)}
                disabled={isSaving}
              >
                <SelectTrigger id="fu-assignee" className="rounded-xl">
                  <SelectValue placeholder="Unassigned">
                    {(value: unknown) =>
                      resolveLabel(
                        value,
                        users.map((u) => ({ value: u.id, label: u.label })),
                        "Unassigned",
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fu-description">Description</Label>
              <Textarea
                id="fu-description"
                placeholder="What is this follow-up about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                rows={3}
                className="resize-none rounded-xl"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fu-notes">Notes</Label>
              <Textarea
                id="fu-notes"
                placeholder="Any additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
                rows={3}
                className="resize-none rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-start gap-3 rounded-xl border p-3">
                <Checkbox
                  id="fu-reminder"
                  checked={reminder}
                  onCheckedChange={(checked) => setReminder(checked === true)}
                  disabled={isSaving}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="fu-reminder" className="font-medium">
                    Flag for a reminder
                  </Label>
                  {/* Honest about what this does: it is a flag on the record,
                      not a scheduled notification. */}
                  <p className="text-xs text-muted-foreground">
                    Marks this follow-up as one to be reminded about. No email or SMS is sent.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSubmit} className="rounded-xl">
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Schedule follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
