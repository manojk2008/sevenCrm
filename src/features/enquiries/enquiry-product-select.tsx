"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { EnquiryProduct } from "@/types/enquiry";
import type { ProductStatus } from "@/types/product";
import { listProducts } from "@/features/products/api";

/**
 * One selectable row. Flattened from either a `Product` (loaded through the
 * Products feature's own API module — there is no second product data source
 * here) or from an `EnquiryProduct` already attached to the enquiry.
 */
interface ProductOption {
  id: string;
  name: string;
  groupName: string;
  price: number;
  status: ProductStatus;
}

interface EnquiryProductSelectProps {
  /** Selected Product ids — the value actually submitted. */
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Products already attached to the enquiry being edited. They seed the
   * option list so an attached product whose status has since flipped to
   * inactive stays visible and stays selectable-off, even though it is not
   * among the active products offered for a new selection.
   */
  attached?: EnquiryProduct[];
  disabled?: boolean;
}

/** Loaded in one page; the backend caps pageSize at 100. */
const PRODUCT_PAGE_SIZE = 100;

export function EnquiryProductSelect({
  value,
  onChange,
  attached,
  disabled,
}: EnquiryProductSelectProps) {
  const [activeProducts, setActiveProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  // Only ACTIVE products are requested: an inactive one cannot be newly
  // attached (the backend rejects it with a 400), so offering it would be a
  // guaranteed failure — same reasoning as listAssignableProductGroups.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await listProducts({ status: "active", pageSize: PRODUCT_PAGE_SIZE });
        if (cancelled) return;
        setActiveProducts(
          result.data.map((product) => ({
            id: product.id,
            name: product.name,
            groupName: product.productGroup.name,
            price: product.price,
            status: product.status,
          })),
        );
        setLoadError("");
      } catch {
        if (cancelled) return;
        setLoadError("Couldn't load products. Close and reopen to retry.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Every product that can appear in the list: the active catalogue, plus
   * any already-attached product missing from it (i.e. one that has since
   * been deactivated). The attached entries are kept out of the *offered*
   * rows below unless they are currently selected.
   */
  const optionsById = useMemo(() => {
    const map = new Map<string, ProductOption>();
    for (const product of activeProducts) map.set(product.id, product);
    for (const link of attached ?? []) {
      if (map.has(link.productId)) continue;
      map.set(link.productId, {
        id: link.productId,
        name: link.name,
        groupName: link.productGroup.name,
        price: link.price,
        status: link.status,
      });
    }
    return map;
  }, [activeProducts, attached]);

  const selectedOptions = useMemo(
    () =>
      value
        .map((id) => optionsById.get(id))
        .filter((option): option is ProductOption => option !== undefined),
    [value, optionsById],
  );

  /**
   * Rows shown in the picker: every active product, plus any selected
   * inactive one so the user can see and intentionally remove it. An
   * inactive product that is *not* selected never appears — it must not be
   * offered as a new selection.
   */
  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = [...optionsById.values()].filter(
      (option) => option.status === "active" || value.includes(option.id),
    );
    const matched = term
      ? rows.filter(
          (option) =>
            option.name.toLowerCase().includes(term) ||
            option.groupName.toLowerCase().includes(term),
        )
      : rows;
    return matched.sort((a, b) => a.name.localeCompare(b.name));
  }, [optionsById, search, value]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((selected) => selected !== id) : [...value, id]);
  };

  return (
    <div className="space-y-3">
      {/* Selected products, each removable. Also the only place an attached
          inactive product is surfaced as part of the current selection. */}
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
                onClick={() => toggle(option.id)}
                className="size-4 opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || isLoading}
        aria-label="Search products"
      />

      <div className="max-h-52 overflow-y-auto rounded-lg border">
        {isLoading && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading products…</p>
        )}

        {!isLoading && loadError && (
          <p className="px-3 py-6 text-center text-sm text-destructive" role="alert">
            {loadError}
          </p>
        )}

        {!isLoading && !loadError && visibleOptions.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-6 w-6 opacity-30" />
            {search.trim()
              ? "No products match your search."
              : "No active products yet. Add one under Products first."}
          </div>
        )}

        {!isLoading &&
          !loadError &&
          visibleOptions.map((option) => {
            const isSelected = value.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(option.id)}
                  disabled={disabled}
                  aria-label={option.name}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{option.name}</span>
                    {option.status === "inactive" && (
                      <Badge variant="warning" className="shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {option.groupName} · {formatCurrency(option.price)}
                  </span>
                </span>
              </label>
            );
          })}
      </div>

      {/* Only shown when it is actually true, so it reads as an explanation
          of what the user is seeing rather than a generic notice. */}
      {selectedOptions.some((option) => option.status === "inactive") && (
        <p className="text-xs text-muted-foreground">
          An inactive product stays attached until you remove it, but can&apos;t be added again.
        </p>
      )}
    </div>
  );
}
