"use client";

/**
 * Tax Rates — a real, organization-scoped feature backed by GET/POST/PATCH
 * /tax-rates (see backend/src/tax-rates). Replaces the old hardcoded
 * initialTaxes array entirely: no local-only state, no fake success
 * messages. SUPER_ADMIN/ADMIN manage; SALES_EXECUTIVE genuinely sees only a
 * read-only table — the backend independently rejects any write from that
 * role regardless of what this page renders.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, Pencil, Power, PowerOff, Percent } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createTaxRate,
  getTaxRateErrorMessage,
  listTaxRates,
  updateTaxRate,
  updateTaxRateStatus,
} from "@/features/tax-rates/api";
import type { TaxRate } from "@/types/tax-rate";

type LoadState = "loading" | "error" | "ready";

/** `id: null` means the draft is a new rate rather than an edit. */
interface RateDraft {
  id: string | null;
  name: string;
  rate: string;
  isDefault: boolean;
}

const EMPTY_DRAFT: RateDraft = { id: null, name: "", rate: "", isDefault: false };

export function TaxSettings() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "super-admin" || role === "admin";

  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [draft, setDraft] = useState<RateDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [busyRateId, setBusyRateId] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await listTaxRates({ search, pageSize: 100 });
      setRates(result.data);
      setLoadState("ready");
    } catch (error) {
      setLoadErrorMessage(getTaxRateErrorMessage(error));
      setLoadState("error");
    }
  }, [search]);

  useEffect(() => {
    Promise.resolve().then(loadRates);
  }, [loadRates]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const parsedRate = draft ? Number(draft.rate) : NaN;
  const isDraftValid =
    !!draft && draft.name.trim().length > 0 && Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100;

  const handleSaveDraft = async () => {
    if (!draft || !isDraftValid) return;
    setIsSaving(true);
    setDraftError("");
    try {
      if (draft.id) {
        await updateTaxRate(draft.id, { name: draft.name.trim(), rate: parsedRate, isDefault: draft.isDefault });
        toast.success("Tax rate updated.");
      } else {
        await createTaxRate({ name: draft.name.trim(), rate: parsedRate, isDefault: draft.isDefault });
        toast.success("Tax rate created.");
      }
      setDraft(null);
      await loadRates();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      // A duplicate name (409) or validation error is shown inline next to
      // the form being edited rather than as a toast, since it's a
      // correctable input error.
      setDraftError(getTaxRateErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (rate: TaxRate) => {
    const nextStatus = rate.status === "active" ? "inactive" : "active";
    setBusyRateId(rate.id);
    try {
      await updateTaxRateStatus(rate.id, nextStatus);
      toast.success(
        nextStatus === "inactive"
          ? `"${rate.name}" deactivated${rate.isDefault ? " — it is no longer the default." : "."}`
          : `"${rate.name}" reactivated.`,
      );
      await loadRates();
    } catch (error) {
      toast.error(getTaxRateErrorMessage(error));
    } finally {
      setBusyRateId(null);
    }
  };

  const isFiltered = !!search;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tax Rates</h2>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Manage the tax rates available when building a quotation. Changing or deactivating a rate never affects quotations already created."
              : "Tax rates available when building a quotation."}
          </p>
        </div>
        {canManage && (
          <Button
            className="rounded-xl"
            onClick={() => {
              setDraft({ ...EMPTY_DRAFT });
              setDraftError("");
            }}
            disabled={!!draft && draft.id === null}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Tax Rate
          </Button>
        )}
      </div>

      <div className="h-px w-full bg-border" />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tax rates..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="rounded-xl pl-8"
        />
      </div>

      {draft && canManage && (
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{draft.id ? "Edit tax rate" : "New tax rate"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-name">Name *</Label>
              <Input
                id="tax-name"
                value={draft.name}
                autoFocus
                placeholder="e.g. CGST"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={`rounded-xl ${draftError ? "border-destructive" : ""}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Rate (%) *</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={draft.rate}
                  placeholder="e.g. 9"
                  onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                  className="rounded-xl pl-9"
                />
              </div>
            </div>
          </div>
          {draftError && (
            <span className="text-xs text-destructive" role="alert">
              {draftError}
            </span>
          )}
          <div className="flex items-center gap-3">
            <Switch
              id="tax-is-default"
              checked={draft.isDefault}
              onCheckedChange={(checked) => setDraft({ ...draft, isDefault: checked })}
            />
            <Label htmlFor="tax-is-default" className="cursor-pointer font-normal">
              Set as the default rate for new quotation lines
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setDraft(null);
                setDraftError("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" className="rounded-xl" onClick={handleSaveDraft} disabled={isSaving || !isDraftValid}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {draft.id ? "Save changes" : "Create rate"}
            </Button>
          </div>
        </div>
      )}

      {loadState === "loading" && <TableSkeleton rows={5} />}

      {loadState === "error" && (
        <ErrorState title="Couldn't load tax rates" description={loadErrorMessage} onRetry={loadRates} />
      )}

      {loadState === "ready" && rates.length === 0 && (
        <EmptyState
          icon={Percent}
          title={isFiltered ? "No tax rates found" : "No tax rates yet"}
          description={
            isFiltered
              ? "We couldn't find any tax rates matching your search."
              : canManage
                ? "Add your first tax rate to use it on quotations."
                : "No tax rates have been configured yet."
          }
          actionLabel={!isFiltered && canManage ? "Add Tax Rate" : undefined}
          onAction={!isFiltered && canManage ? () => setDraft({ ...EMPTY_DRAFT }) : undefined}
        />
      )}

      {loadState === "ready" && rates.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Tax Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.name}</TableCell>
                  <TableCell>{rate.rate}%</TableCell>
                  <TableCell>
                    {rate.isDefault && (
                      <Badge variant="info" className="rounded-full">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rate.status === "active" ? "success" : "secondary"} className="capitalize">
                      {rate.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${rate.name}`}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setDraft({
                              id: rate.id,
                              name: rate.name,
                              rate: String(rate.rate),
                              isDefault: rate.isDefault,
                            });
                            setDraftError("");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={rate.status === "active" ? `Deactivate ${rate.name}` : `Reactivate ${rate.name}`}
                          disabled={busyRateId === rate.id}
                          className={`h-8 w-8 ${rate.status === "active" ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => handleToggleStatus(rate)}
                        >
                          {busyRateId === rate.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : rate.status === "active" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
