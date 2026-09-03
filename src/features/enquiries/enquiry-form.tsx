"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import type { Enquiry, EnquirySource } from "@/types/enquiry";
import type { Priority } from "@/types/common";
import { ApiError } from "@/lib/api";
import { listClients } from "@/features/clients/api";
import { listUsers } from "@/features/users/api";
import { EnquiryProductSelect } from "./enquiry-product-select";
import {
  listEnquirySources,
  createEnquirySource,
  getEnquirySourceErrorMessage,
  type EnquiryFormValues,
} from "./api";

interface ClientOption {
  id: string;
  label: string;
}

interface UserOption {
  id: string;
  label: string;
}

interface EnquiryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  enquiry?: Enquiry;
  onSubmit: (values: EnquiryFormValues) => Promise<void>;
  /**
   * Pre-selects the client when creating (e.g. opened right after that
   * client was created from the Client form). Ignored when editing — the
   * client field stays fully editable either way, this only seeds its
   * starting value.
   */
  initialClientId?: string;
}

/** `<input type="date">` needs `YYYY-MM-DD`; the API returns full ISO. */
function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * Sentinel Select value for the "+ Add new source" row — never a real
 * source id (those are cuids from the database), so it can never collide
 * with an actual selection.
 */
const ADD_NEW_SOURCE_VALUE = "__add_new_source__";

export function EnquiryForm({ open, onOpenChange, enquiry, onSubmit, initialClientId }: EnquiryFormProps) {
  const isEdit = !!enquiry;

  // The parent renders this component only while the dialog is open, so it
  // remounts on every open — prefilling from props here is enough, and avoids
  // a reset effect that would re-render on mount.
  const [title, setTitle] = useState(enquiry?.title ?? "");
  const [clientId, setClientId] = useState(enquiry?.clientId ?? initialClientId ?? "");
  const [expectedRevenue, setExpectedRevenue] = useState(
    enquiry ? String(enquiry.expectedRevenue) : "",
  );
  const [probability, setProbability] = useState(enquiry ? String(enquiry.probability) : "");
  const [priority, setPriority] = useState<Priority>(enquiry?.priority ?? "medium");
  // "" means no source selected — source is optional.
  const [sourceId, setSourceId] = useState(enquiry?.sourceId ?? "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    toDateInputValue(enquiry?.expectedCloseDate),
  );
  const [description, setDescription] = useState(enquiry?.description ?? "");
  const [assignedToId, setAssignedToId] = useState(enquiry?.assignedTo ?? "");
  // Seeded from the enquiry's real attached products (their stable Product
  // ids), so editing starts from what is actually persisted — including any
  // product that has since been deactivated.
  const [productIds, setProductIds] = useState<string[]>(
    () => enquiry?.products.map((product) => product.productId) ?? [],
  );

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sources, setSources] = useState<EnquirySource[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // "+ Add new source" dialog, opened from inside the Source Select itself.
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [isCreatingSource, setIsCreatingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState("");

  // Real Clients/Users/Sources data — no mock lists, and no second data
  // source for any of these three features (each reuses its own feature's
  // existing API module; there is no hardcoded source list anywhere).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const [clientResult, userResult, sourceResult] = await Promise.all([
          listClients({ status: "active", pageSize: 100 }),
          listUsers(),
          listEnquirySources(),
        ]);
        if (cancelled) return;
        setClients(clientResult.data.map((c) => ({ id: c.id, label: c.name })));
        setUsers(userResult.map((u) => ({ id: u.id, label: u.name })));
        setSources(sourceResult);
        setOptionsError("");
      } catch {
        if (cancelled) return;
        setOptionsError("Couldn't load clients, users and sources. Close and reopen to retry.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const revenueNumber = Number(expectedRevenue);
  const probabilityNumber = Number(probability);
  const canSubmit =
    title.trim().length > 0 &&
    clientId.length > 0 &&
    expectedRevenue.length > 0 &&
    Number.isFinite(revenueNumber) &&
    revenueNumber >= 0 &&
    probability.length > 0 &&
    Number.isInteger(probabilityNumber) &&
    probabilityNumber >= 0 &&
    probabilityNumber <= 100 &&
    expectedCloseDate.length > 0 &&
    !isSaving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setFormError("");
    try {
      await onSubmit({
        title: title.trim(),
        clientId,
        expectedRevenue: revenueNumber,
        probability: probabilityNumber,
        priority,
        sourceId,
        expectedCloseDate,
        description: description.trim() || undefined,
        assignedToId: assignedToId || undefined,
        productIds,
      });
      // The parent closes the dialog on success; entered values are left
      // intact here so a failure keeps the user's work.
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save the enquiry.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * The Source Select's onValueChange: the sentinel "+ Add new source" row
   * opens the Add Source dialog instead of ever becoming the selected
   * value — a real selection is any other value (an actual source id).
   */
  const handleSourceSelect = (value: string | null) => {
    if (value === ADD_NEW_SOURCE_VALUE) {
      setNewSourceName("");
      setAddSourceError("");
      setIsAddSourceOpen(true);
      return;
    }
    setSourceId(value ?? "");
  };

  const handleAddSource = async () => {
    const name = newSourceName.trim();
    if (!name) return;
    setIsCreatingSource(true);
    setAddSourceError("");
    try {
      const created = await createEnquirySource(name);
      setSources((prev) =>
        [...prev.filter((s) => s.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      // Automatically selected — the user never has to reopen the dropdown
      // and pick what they just typed.
      setSourceId(created.id);
      setIsAddSourceOpen(false);
      setNewSourceName("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Duplicate — re-list (in case another tab/session just created it
        // moments ago) and let the user use the existing one instead of
        // being stuck on a rejected create.
        try {
          const refreshed = await listEnquirySources();
          setSources(refreshed);
          const existing = refreshed.find((s) => s.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            setSourceId(existing.id);
            setIsAddSourceOpen(false);
            setNewSourceName("");
            return;
          }
        } catch {
          // Fall through to showing the original error below.
        }
      }
      setAddSourceError(getEnquirySourceErrorMessage(error));
    } finally {
      setIsCreatingSource(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit enquiry" : "Add enquiry"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this enquiry's details."
              : "Log a new sales enquiry and track it through your pipeline."}
          </DialogDescription>
        </DialogHeader>

        <div style={{ padding: '20px 24px' }}>
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Enquiry details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="enq-title">Title *</Label>
                <Input
                  id="enq-title"
                  placeholder="e.g. ERP Implementation for ABC Corp"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="enq-client">Client *</Label>
                <Select
                  value={clientId}
                  onValueChange={(v) => setClientId(v ?? "")}
                  // The backend does not allow re-parenting an enquiry to a
                  // different client, so this is fixed once created.
                  disabled={isSaving || isEdit}
                >
                  <SelectTrigger id="enq-client">
                    {/* Value is the client's id (needed for the payload), so
                        the trigger needs an explicit render function — left
                        to its default, base-ui's SelectValue displays the
                        raw id string instead of the client's name. */}
                    <SelectValue placeholder="Select a client...">
                      {(value: string) => clients.find((c) => c.id === value)?.label ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEdit && (
                  <p className="text-xs text-muted-foreground">
                    The client can&apos;t be changed after an enquiry is created.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="enq-revenue">Expected revenue (₹) *</Label>
                <Input
                  id="enq-revenue"
                  type="number"
                  min={0}
                  step="0.01"
                  value={expectedRevenue}
                  onChange={(e) => setExpectedRevenue(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enq-probability">Probability (%) *</Label>
                <Input
                  id="enq-probability"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Products</h3>
            <div className="space-y-2">
              <Label>Products enquired about</Label>
              <EnquiryProductSelect
                value={productIds}
                onChange={setProductIds}
                attached={enquiry?.products}
                disabled={isSaving}
              />
            </div>
          </section>


          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Classification</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="space-y-2">
                <Label htmlFor="enq-priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)} disabled={isSaving}>
                  <SelectTrigger id="enq-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enq-source">Source</Label>
                <Select value={sourceId || undefined} onValueChange={handleSourceSelect} disabled={isSaving}>
                  <SelectTrigger id="enq-source">
                    <SelectValue placeholder="Select source...">
                      {(value: string) => sources.find((s) => s.id === value)?.name ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {sources.length > 0 && <SelectSeparator />}
                    <SelectItem value={ADD_NEW_SOURCE_VALUE}>
                      <Plus className="mr-1.5 inline h-3.5 w-3.5" /> Add new source
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enq-assignee">Assigned to</Label>
                <Select value={assignedToId} onValueChange={(v) => setAssignedToId(v ?? "")} disabled={isSaving}>
                  <SelectTrigger id="enq-assignee">
                    <SelectValue placeholder="Unassigned">
                      {(value: string) => users.find((u) => u.id === value)?.label ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {/* User-facing label only — this still drives the
                    `expectedCloseDate` field/API/DB column unchanged. It now
                    controls the Enquiry's automatically-synchronized Follow-up
                    (see ensureNextFollowUp in
                    src/features/enquiries/follow-up-sync.ts) rather than a
                    deal-closing estimate. */}
                <Label htmlFor="enq-close-date">Next follow-up date *</Label>
                <Input
                  id="enq-close-date"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="space-y-2">
              <Label htmlFor="enq-description">Description</Label>
              <Textarea
                id="enq-description"
                placeholder="Requirements details..."
                className="resize-none"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </section>

          {optionsError && (
            <p className="mt-4 text-sm text-destructive" role="alert">{optionsError}</p>
          )}
          {formError && (
            <p className="mt-4 text-sm text-destructive" role="alert">{formError}</p>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-background py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Save enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={isAddSourceOpen}
      onOpenChange={(next) => !isCreatingSource && setIsAddSourceOpen(next)}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add source</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-source-name">Source name</Label>
          <Input
            id="new-source-name"
            value={newSourceName}
            onChange={(e) => {
              setNewSourceName(e.target.value);
              setAddSourceError("");
            }}
            placeholder="e.g. Google Ads"
            maxLength={100}
            disabled={isCreatingSource}
          />
          {addSourceError && (
            <p className="text-xs text-destructive" role="alert">{addSourceError}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsAddSourceOpen(false)}
            disabled={isCreatingSource}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddSource}
            disabled={newSourceName.trim().length === 0 || isCreatingSource}
          >
            {isCreatingSource ? "Adding…" : "Add source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
