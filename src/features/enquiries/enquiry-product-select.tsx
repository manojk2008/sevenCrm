"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { EnquiryProduct } from "@/types/enquiry";
import type { ProductStatus } from "@/types/product";
import { listAssignableProductGroups, listProducts, createProduct } from "@/features/products/api";
import { ProductForm, type ProductFormValues } from "@/features/products/product-form";

/**
 * One selectable row, flattened from either a `Product` (loaded through the
 * Products feature's own API module — there is no second product data
 * source here) or from an `EnquiryProduct` already attached to the enquiry.
 */
interface ProductOption {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  price: number;
  status: ProductStatus;
}

interface GroupOption {
  id: string;
  name: string;
}

interface EnquiryProductSelectProps {
  /** Selected Product ids — the value actually submitted. */
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Products already attached to the enquiry being edited. They seed the
   * option cache so an attached product whose status has since flipped to
   * inactive — or whose group is no longer active — stays visible as a
   * selected chip and stays removable, even though it is not offered again
   * as a fresh selection.
   */
  attached?: EnquiryProduct[];
  disabled?: boolean;
}

type LoadState = "loading" | "error" | "ready";

function toOption(product: {
  id: string;
  name: string;
  productGroupId: string;
  productGroup: { id: string; name: string };
  price: number;
  status: ProductStatus;
}): ProductOption {
  return {
    id: product.id,
    name: product.name,
    groupId: product.productGroupId,
    groupName: product.productGroup.name,
    price: product.price,
    status: product.status,
  };
}

/** Products are picked by Product Group first: pick a group, then pick or
 * create a Product that belongs to it. The persisted association is still
 * plain Product ids (`value`/`onChange`) — EnquiryProduct(productId) is
 * unchanged; the Group is only ever the selection/filtering mechanism, and
 * an enquiry can freely mix Products from several Groups (see the running
 * `productCache`, which is never cleared when the browsed group changes). */
export function EnquiryProductSelect({
  value,
  onChange,
  attached,
  disabled,
}: EnquiryProductSelectProps) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupsState, setGroupsState] = useState<LoadState>("loading");
  const [groupsError, setGroupsError] = useState("");

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupProducts, setGroupProducts] = useState<ProductOption[]>([]);
  const [productsState, setProductsState] = useState<LoadState>("ready");
  const [productsError, setProductsError] = useState("");

  // Accumulates every ProductOption ever seen — seeded from the enquiry's
  // already-attached products, then topped up as each group is browsed and
  // whenever a product is created inline. Never reset on group switch, so a
  // chip picked from one group keeps rendering correctly after the picker
  // moves on to another group.
  const [productCache, setProductCache] = useState<Map<string, ProductOption>>(() => {
    const map = new Map<string, ProductOption>();
    for (const link of attached ?? []) {
      map.set(link.productId, {
        id: link.productId,
        name: link.name,
        groupId: link.productGroup.id,
        groupName: link.productGroup.name,
        price: link.price,
        status: link.status,
      });
    }
    return map;
  });

  const [isProductFormOpen, setIsProductFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsState("loading");
      try {
        const active = await listAssignableProductGroups();
        if (cancelled) return;
        setGroups(active.map((g) => ({ id: g.id, name: g.name })));
        setGroupsState("ready");
      } catch {
        if (cancelled) return;
        setGroupsError("Couldn't load product groups. Close and reopen to retry.");
        setGroupsState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only ACTIVE products are requested: an inactive one cannot be newly
  // attached (the backend rejects it with a 400), so offering it would be a
  // guaranteed failure — same reasoning EnquiryProductSelect always used.
  useEffect(() => {
    // Nothing to fetch yet — `groupProducts` starts empty and there is
    // currently no UI path that clears `selectedGroupId` back to "" once
    // set, so no reset is needed here (setting state synchronously in an
    // effect body is exactly what the deferred-fetch branch below avoids).
    if (!selectedGroupId) return;
    let cancelled = false;
    (async () => {
      setProductsState("loading");
      try {
        const result = await listProducts({ productGroupId: selectedGroupId, status: "active" });
        if (cancelled) return;
        const options = result.data.map(toOption);
        setGroupProducts(options);
        setProductCache((prev) => {
          const next = new Map(prev);
          for (const option of options) next.set(option.id, option);
          return next;
        });
        setProductsError("");
        setProductsState("ready");
      } catch {
        if (cancelled) return;
        setProductsError("Couldn't load products for this group. Try again.");
        setProductsState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  const selectedOptions = useMemo(
    () =>
      value
        .map((id) => productCache.get(id))
        .filter((option): option is ProductOption => option !== undefined),
    [value, productCache],
  );

  // Products offered in the "add" picker for the currently browsed group:
  // active products in that group, minus whatever is already selected.
  const availableGroupProducts = useMemo(
    () => groupProducts.filter((option) => !value.includes(option.id)),
    [groupProducts, value],
  );

  const addProduct = (productId: string) => {
    if (value.includes(productId)) return;
    onChange([...value, productId]);
  };

  const removeProduct = (productId: string) => {
    onChange(value.filter((id) => id !== productId));
  };

  const handleCreateProduct = async (values: ProductFormValues) => {
    const created = await createProduct({
      name: values.name,
      productGroupId: values.productGroupId,
      description: values.description,
      price: values.price,
      sku: values.sku,
      unit: values.unit,
    });
    const option = toOption(created);
    setProductCache((prev) => new Map(prev).set(option.id, option));
    if (option.groupId === selectedGroupId) {
      setGroupProducts((prev) => (prev.some((p) => p.id === option.id) ? prev : [...prev, option]));
    }
    addProduct(option.id);
    // ProductForm closes itself (and shows its own success toast) once this
    // resolves — nothing further to do here.
  };

  return (
    <div className="space-y-4">
      {/* Selected products, each removable — spans every group the user has
          picked from, not just the one currently being browsed. */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge
              key={option.id}
              variant={option.status === "inactive" ? "warning" : "secondary"}
              className="h-7 gap-1 pr-1 pl-2.5"
            >
              <span className="max-w-[180px] truncate">{option.name}</span>
              {option.status === "inactive" && (
                <span className="text-[10px] uppercase opacity-80">inactive</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${option.name}`}
                disabled={disabled}
                onClick={() => removeProduct(option.id)}
                className="size-4 opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Product group</span>
        {groupsState === "loading" ? (
          <div className="flex h-9 items-center rounded-lg border border-input px-3 text-sm text-muted-foreground">
            Loading product groups…
          </div>
        ) : groupsState === "error" ? (
          <p className="text-xs text-destructive" role="alert">{groupsError}</p>
        ) : (
          <Select
            value={selectedGroupId || undefined}
            onValueChange={(v) => setSelectedGroupId(v ?? "")}
            disabled={disabled || groups.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product group…" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {groupsState === "ready" && groups.length === 0 && (
          <p className="text-xs text-muted-foreground">No active product groups yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Product</span>
        <div className="flex gap-2">
          <div className="flex-1">
            {!selectedGroupId ? (
              <div className="flex h-9 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">
                Select a product group first
              </div>
            ) : productsState === "loading" ? (
              <div className="flex h-9 items-center rounded-lg border border-input px-3 text-sm text-muted-foreground">
                Loading products…
              </div>
            ) : productsState === "error" ? (
              <p className="text-xs text-destructive" role="alert">{productsError}</p>
            ) : (
              <Select
                // No persistent value: picking an item adds it to the
                // selection immediately, then the control resets so it's
                // ready to add another from the same group.
                value=""
                onValueChange={(v) => v && addProduct(v)}
                disabled={disabled || availableGroupProducts.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      availableGroupProducts.length === 0
                        ? "No available products in this group"
                        : "Select a product…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableGroupProducts.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} — {formatCurrency(option.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !selectedGroupId}
            onClick={() => setIsProductFormOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> New Product
          </Button>
        </div>
        {selectedGroupId && !disabled && productsState === "ready" && groupProducts.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> No active products in this group yet — create one above.
          </p>
        )}
      </div>

      {isProductFormOpen && (
        <ProductForm
          open={isProductFormOpen}
          onOpenChange={setIsProductFormOpen}
          product={null}
          onSubmit={handleCreateProduct}
          canManageGroups={false}
          onManageGroups={() => {}}
          defaultProductGroupId={selectedGroupId}
        />
      )}
    </div>
  );
}
