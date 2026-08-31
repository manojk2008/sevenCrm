"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import type { Product, ProductGroup } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAssignableProductGroups, getProductErrorMessage, getProductGroupErrorMessage } from "./api";

// Mirrors the backend's CreateProductDto/UpdateProductDto validation so the
// user gets an inline error instead of a round-trip 400. Deliberately has no
// stock/gstRate/hsnCode/specifications/status: none of those exist on the
// approved Product model (see backend/prisma/schema.prisma), and status is
// changed from the list via its own endpoint, never through this form.
const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200, "Name is too long"),
  productGroupId: z.string().min(1, "Product group is required"),
  description: z.string().max(5000, "Description is too long").optional(),
  price: z.coerce
    .number({ message: "Price must be a number" })
    .min(0, "Price cannot be negative")
    .max(999_999_999_999.99, "Price is too large")
    // Decimal(14,2) cannot store more precision — rejected here rather than
    // being silently rounded by the database.
    .refine((value) => {
      const decimals = String(value).split(".")[1];
      return decimals === undefined || decimals.length <= 2;
    }, "Price can have at most 2 decimal places"),
  sku: z.string().optional(),
  unit: z.string().optional(),
});

type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormValues = z.output<typeof productSchema>;

const emptyProduct: ProductFormInput = {
  name: "",
  productGroupId: "",
  description: "",
  price: 0,
  sku: "",
  unit: "",
};

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  /** Admin/Super Admin only — enables the shortcut to the group manager. */
  canManageGroups: boolean;
  /** Opens the Manage Groups dialog (closes this form first). */
  onManageGroups: () => void;
  /**
   * Pre-selects the product group when creating (e.g. opened from the
   * Enquiry form's already-chosen group). Ignored when editing an existing
   * product, which always starts from its own current group.
   */
  defaultProductGroupId?: string;
}

type GroupsState = "loading" | "error" | "ready";

/** A selectable group option; `inactive` marks the edited product's own group. */
interface GroupOption {
  id: string;
  name: string;
  inactive: boolean;
}

export function ProductForm({
  open,
  onOpenChange,
  product,
  onSubmit,
  canManageGroups,
  onManageGroups,
  defaultProductGroupId,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, undefined, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProduct,
  });

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupsState, setGroupsState] = useState<GroupsState>("loading");
  const [groupsError, setGroupsError] = useState("");

  const productGroupId = watch("productGroupId");

  const loadGroups = useCallback(async () => {
    setGroupsState("loading");
    try {
      const active = await listAssignableProductGroups();
      const options: GroupOption[] = active.map((group: ProductGroup) => ({
        id: group.id,
        name: group.name,
        inactive: false,
      }));

      // When editing a product whose group has since been deactivated, that
      // group is not in the assignable list. It is added here so the product
      // keeps showing its real group and can be saved without being forced
      // to move — it is only ever added for the product being edited, so it
      // is never offered as a destination for any other product.
      if (product && !options.some((option) => option.id === product.productGroupId)) {
        options.unshift({
          id: product.productGroupId,
          name: product.productGroup.name,
          inactive: true,
        });
      }

      setGroups(options);
      setGroupsState("ready");
    } catch (error) {
      setGroupsError(getProductGroupErrorMessage(error));
      setGroupsState("error");
    }
  }, [product]);

  useEffect(() => {
    if (!open) return;
    reset(
      product
        ? {
            name: product.name,
            productGroupId: product.productGroupId,
            description: product.description,
            price: product.price,
            sku: product.sku,
            unit: product.unit,
          }
        : { ...emptyProduct, productGroupId: defaultProductGroupId ?? "" },
    );
    void loadGroups();
  }, [open, product, reset, loadGroups, defaultProductGroupId]);

  const hasNoAssignableGroups =
    groupsState === "ready" && groups.filter((group) => !group.inactive).length === 0;
  // A new product genuinely cannot be created without an active group; an
  // existing one can still be saved because it keeps its current group.
  const blockedByMissingGroups = hasNoAssignableGroups && !product;

  const save = async (values: ProductFormValues) => {
    try {
      await onSubmit(values);
    } catch (error) {
      toast.error(getProductErrorMessage(error));
      return;
    }
    toast.success(product ? "Product updated" : "Product created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6 pb-4">
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update this product's details."
              : "Add a new product to your organization's catalog."}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
          <form id="product-form" onSubmit={handleSubmit(save)} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Product details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="product-name" label="Product name" required error={errors.name?.message}>
                  <Input
                    id="product-name"
                    placeholder="e.g. Welding Machine 250A"
                    {...register("name")}
                    className={errors.name ? "border-destructive" : ""}
                  />
                </Field>

                <Field
                  id="product-group"
                  label="Product group"
                  required
                  error={errors.productGroupId?.message}
                >
                  {groupsState === "loading" ? (
                    <div className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading groups…
                    </div>
                  ) : groupsState === "error" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive">{groupsError}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => void loadGroups()}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={productGroupId || undefined}
                      onValueChange={(value) =>
                        value && setValue("productGroupId", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger
                        id="product-group"
                        className={errors.productGroupId ? "w-full border-destructive" : "w-full"}
                        disabled={groups.length === 0}
                      >
                        <SelectValue placeholder="Select product group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.inactive ? `${group.name} (Inactive)` : group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field id="product-price" label="Price (₹)" required error={errors.price?.message}>
                  <Input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("price")}
                    className={errors.price ? "border-destructive" : ""}
                  />
                </Field>

                <Field id="product-unit" label="Unit" error={errors.unit?.message}>
                  <Input
                    id="product-unit"
                    placeholder="e.g. piece, kg, hour, licence"
                    {...register("unit")}
                  />
                </Field>

                <Field id="product-sku" label="SKU" error={errors.sku?.message}>
                  <Input id="product-sku" placeholder="Optional" {...register("sku")} />
                </Field>

                <Field
                  id="product-description"
                  label="Description"
                  error={errors.description?.message}
                  className="md:col-span-2"
                >
                  <Textarea
                    id="product-description"
                    rows={3}
                    placeholder="Detailed product description…"
                    className="resize-none"
                    {...register("description")}
                  />
                </Field>
              </div>
            </section>

            {hasNoAssignableGroups && (
              <div className="rounded-xl border border-dashed bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">
                  No active product groups available
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product
                    ? "This product keeps its current group, but no active group is available to move it to."
                    : canManageGroups
                      ? "Every product must belong to a product group. Create or reactivate one to continue."
                      : "Every product must belong to a product group. An administrator must create or reactivate one before products can be added."}
                </p>
                {canManageGroups && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      onOpenChange(false);
                      onManageGroups();
                    }}
                  >
                    <Settings2 className="mr-2 h-4 w-4" /> Manage groups
                  </Button>
                )}
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background p-6 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="product-form"
            disabled={isSubmitting || groupsState !== "ready" || blockedByMissingGroups}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id} className={error ? "text-destructive" : ""}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {error && (
        <span id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
