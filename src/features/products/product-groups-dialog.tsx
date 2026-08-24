"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, Pencil, Power, PowerOff, Layers } from "lucide-react";
import type { ProductGroup } from "@/types/product";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listProductGroups,
  createProductGroup,
  updateProductGroup,
  updateProductGroupStatus,
  getProductGroupErrorMessage,
} from "./api";

type LoadState = "loading" | "error" | "ready";

/** `id: null` means the draft is a new group rather than an edit. */
interface GroupDraft {
  id: string | null;
  name: string;
  description: string;
}

const PAGE_SIZE = 8;

interface ProductGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful change so the products list can refresh. */
  onChanged: () => void;
  onUnauthorized: () => void;
}

/**
 * Admin-only management surface for organization-defined product groups.
 * Lives inside the Products module as a dialog rather than its own route —
 * there is deliberately no /product-groups page and no navigation entry.
 *
 * There is no delete: the backend exposes no DELETE route (a group holding
 * products could not be removed anyway), so deactivation is the lifecycle.
 */
export function ProductGroupsDialog({
  open,
  onOpenChange,
  onChanged,
  onUnauthorized,
}: ProductGroupsDialogProps) {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await listProductGroups({ search, page, pageSize: PAGE_SIZE });
      setGroups(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }
      setLoadErrorMessage(getProductGroupErrorMessage(error));
      setLoadState("error");
    }
  }, [search, page, onUnauthorized]);

  useEffect(() => {
    if (!open) return;
    void loadGroups();
  }, [open, loadGroups]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  /** Clears transient UI on close so the next open starts fresh. */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDraft(null);
      setDraftError("");
      setSearchInput("");
      setSearch("");
      setPage(1);
    }
    onOpenChange(next);
  };

  /** A new search always starts back at page 1. */
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleSaveDraft = async () => {
    if (!draft || !draft.name.trim()) return;
    setIsSaving(true);
    setDraftError("");
    try {
      if (draft.id) {
        await updateProductGroup(draft.id, {
          name: draft.name.trim(),
          description: draft.description,
        });
        toast.success("Product group updated");
      } else {
        await createProductGroup({
          name: draft.name.trim(),
          description: draft.description,
        });
        toast.success("Product group created");
      }
      setDraft(null);
      await loadGroups();
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }
      // A duplicate name (409) is shown inline next to the field being
      // edited rather than as a toast, since it's a correctable input error.
      setDraftError(getProductGroupErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (group: ProductGroup) => {
    const nextStatus = group.status === "active" ? "inactive" : "active";
    setBusyGroupId(group.id);
    try {
      await updateProductGroupStatus(group.id, nextStatus);
      toast.success(
        nextStatus === "inactive"
          ? `"${group.name}" deactivated — its ${group.productCount} product${group.productCount === 1 ? "" : "s"} are unchanged, but no new products can be added to it.`
          : `"${group.name}" reactivated`,
      );
      await loadGroups();
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }
      toast.error(getProductGroupErrorMessage(error));
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-6 pb-4">
          <DialogTitle>Manage product groups</DialogTitle>
          <DialogDescription>
            Product groups are defined by your organization. Deactivating a group keeps its existing
            products unchanged but prevents new products from being added to it.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                className="bg-muted/40 pl-9"
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setDraft({ id: null, name: "", description: "" });
                setDraftError("");
              }}
              disabled={!!draft && draft.id === null}
            >
              <Plus className="mr-2 h-4 w-4" /> New group
            </Button>
          </div>

          {draft && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold">
                {draft.id ? "Edit product group" : "New product group"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="group-name">Name *</Label>
                <Input
                  id="group-name"
                  value={draft.name}
                  autoFocus
                  placeholder="e.g. Welding Machines"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className={draftError ? "border-destructive" : ""}
                />
                {draftError && (
                  <span className="text-xs text-destructive" role="alert">
                    {draftError}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Textarea
                  id="group-description"
                  rows={2}
                  className="resize-none"
                  placeholder="Optional"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft(null);
                    setDraftError("");
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveDraft} disabled={isSaving || !draft.name.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {draft.id ? "Save changes" : "Create group"}
                </Button>
              </div>
            </div>
          )}

          {loadState === "loading" && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading product groups…
            </div>
          )}

          {loadState === "error" && (
            <ErrorState
              title="Couldn't load product groups"
              description={loadErrorMessage}
              onRetry={loadGroups}
            />
          )}

          {loadState === "ready" && (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Name
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Products
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length ? (
                    groups.map((group) => (
                      <TableRow key={group.id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="font-medium text-foreground">{group.name}</div>
                          {group.description && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {group.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {group.productCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={group.status === "active" ? "success" : "secondary"}
                            className="capitalize"
                          >
                            {group.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${group.name}`}
                              onClick={() => {
                                setDraft({
                                  id: group.id,
                                  name: group.name,
                                  description: group.description,
                                });
                                setDraftError("");
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={
                                group.status === "active"
                                  ? `Deactivate ${group.name}`
                                  : `Reactivate ${group.name}`
                              }
                              disabled={busyGroupId === group.id}
                              className={group.status === "active" ? "text-destructive" : ""}
                              onClick={() => handleToggleStatus(group)}
                            >
                              {busyGroupId === group.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : group.status === "active" ? (
                                <PowerOff className="h-3.5 w-3.5" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Layers className="mb-3 h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm font-medium text-foreground">
                            {search ? "No groups match your search" : "No product groups yet"}
                          </p>
                          <p className="text-xs">
                            {search
                              ? "Try a different search term."
                              : "Create your first product group to start adding products."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Showing {groups.length} of {total}
                  </span>
                  <div className="flex gap-2">
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
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background p-6 pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
