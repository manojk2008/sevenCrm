"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENQUIRY_SOURCES } from "@/types/enquiry";
import type { Enquiry, EnquirySource } from "@/types/enquiry";
import type { Priority } from "@/types/common";
import { listClients } from "@/features/clients/api";
import { listUsers } from "@/features/users/api";
import { EnquiryProductSelect } from "./enquiry-product-select";
import type { EnquiryFormValues } from "./api";

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
}

/** `<input type="date">` needs `YYYY-MM-DD`; the API returns full ISO. */
function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function EnquiryForm({ open, onOpenChange, enquiry, onSubmit }: EnquiryFormProps) {
  const isEdit = !!enquiry;

  // The parent renders this component only while the dialog is open, so it
  // remounts on every open — prefilling from props here is enough, and avoids
  // a reset effect that would re-render on mount.
  const [title, setTitle] = useState(enquiry?.title ?? "");
  const [clientId, setClientId] = useState(enquiry?.clientId ?? "");
  const [expectedRevenue, setExpectedRevenue] = useState(
    enquiry ? String(enquiry.expectedRevenue) : "",
  );
  const [probability, setProbability] = useState(enquiry ? String(enquiry.probability) : "");
  const [priority, setPriority] = useState<Priority>(enquiry?.priority ?? "medium");
  const [source, setSource] = useState<EnquirySource | "">(enquiry?.source ?? "");
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
  const [optionsError, setOptionsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Real Clients/Users data — no mock lists, and no second data source for
  // either feature (both reuse their own feature's existing API module).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const [clientResult, userResult] = await Promise.all([
          listClients({ status: "active", pageSize: 100 }),
          listUsers(),
        ]);
        if (cancelled) return;
        setClients(clientResult.data.map((c) => ({ id: c.id, label: c.name })));
        setUsers(userResult.map((u) => ({ id: u.id, label: u.name })));
        setOptionsError("");
      } catch {
        if (cancelled) return;
        setOptionsError("Couldn't load clients and users. Close and reopen to retry.");
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
    source.length > 0 &&
    expectedCloseDate.length > 0 &&
    !isSaving;

  const handleSave = async () => {
    if (!canSubmit || !source) return;
    setIsSaving(true);
    setFormError("");
    try {
      await onSubmit({
        title: title.trim(),
        clientId,
        expectedRevenue: revenueNumber,
        probability: probabilityNumber,
        priority,
        source,
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

  return (
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
                  placeholder="500000"
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
                  placeholder="50"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  disabled={isSaving}
                />
              </div>
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
                <Label htmlFor="enq-source">Source *</Label>
                <Select value={source} onValueChange={(v) => setSource(v as EnquirySource)} disabled={isSaving}>
                  <SelectTrigger id="enq-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENQUIRY_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
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
                <Label htmlFor="enq-close-date">Expected close date *</Label>
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
  );
}
