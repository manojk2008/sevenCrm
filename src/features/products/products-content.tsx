"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Edit,
  PowerOff,
  RotateCcw,
  Package,
  Settings2,
} from "lucide-react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Product, ProductGroup } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/lib/format";
import { ProductForm, type ProductFormValues } from "./product-form";
import { ProductGroupsDialog } from "./product-groups-dialog";
import {
  listProducts,
  listProductGroups,
  createProduct,
  updateProduct,
  updateProductStatus,
  getProductErrorMessage,
  type StatusFilter,
} from "./api";

type LoadState = "loading" | "error" | "ready";

const PAGE_SIZE = 10;
const ALL_GROUPS = "all";

export function ProductsContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  // UX gating only — the backend (SUPER_ADMIN/ADMIN on every write) remains
  // the actual authorization boundary. src/constants/roles.ts is dead
  // configuration and is deliberately not used here.
  const canManage = currentUser?.role === "super-admin" || currentUser?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [groups, setGroups] = useState<ProductGroup[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS);

  const [view, setView] = useState<"table" | "grid">("table");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isGroupsDialogOpen, setIsGroupsDialogOpen] = useState(false);
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // A 401 means the session is gone — the backend is authoritative, so we
  // clear local state and send the user back to login rather than leaving a
  // stale "authenticated" UI showing (mirrors clients-content.tsx).
  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const loadProducts = useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await listProducts({
        search,
        status: statusFilter,
        productGroupId: groupFilter === ALL_GROUPS ? undefined : groupFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setProducts(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getProductErrorMessage(error));
      setLoadState("error");
    }
  }, [search, statusFilter, groupFilter, page, handleUnauthorized]);

  // Groups drive the filter dropdown. Loaded separately from the product
  // list so a group-loading hiccup never blanks the catalog itself.
  const loadGroups = useCallback(async () => {
    try {
      const result = await listProductGroups({ pageSize: 100 });
      setGroups(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
      }
      // Non-fatal: the group filter simply stays empty.
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  // Debounce free-text search before it drives a request.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // A new search/filter always starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, groupFilter]);

  const handleFormSubmit = async (values: ProductFormValues) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        name: values.name,
        // Only sent when the user actually changed the group, so a product
        // whose group was deactivated can still be saved untouched.
        productGroupId:
          values.productGroupId !== editingProduct.productGroupId ? values.productGroupId : undefined,
        description: values.description,
        price: values.price,
        sku: values.sku,
        unit: values.unit,
      });
    } else {
      await createProduct({
        name: values.name,
        productGroupId: values.productGroupId,
        description: values.description,
        price: values.price,
        sku: values.sku,
        unit: values.unit,
      });
    }
    await loadProducts();
    await loadGroups();
  };

  const handleReactivate = async (product: Product) => {
    try {
      await updateProductStatus(product.id, "active");
      toast.success(`${product.name} has been reactivated`);
      await loadProducts();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getProductErrorMessage(error));
    }
  };

  const handleDeactivate = async () => {
    if (!productToDeactivate) return;
    setIsDeactivating(true);
    try {
      await updateProductStatus(productToDeactivate.id, "inactive");
      toast.success(`${productToDeactivate.name} has been deactivated`);
      setProductToDeactivate(null);
      await loadProducts();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getProductErrorMessage(error));
    } finally {
      setIsDeactivating(false);
    }
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.name}</div>
          {row.original.sku && (
            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.sku}</div>
          )}
        </div>
      ),
    },
    {
      id: "productGroup",
      header: "Product Group",
      cell: ({ row }) => (
        <Badge variant="secondary" className="rounded-md">
          {row.original.productGroup.name}
        </Badge>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{formatCurrency(row.original.price)}</span>
      ),
    },
    {
      accessorKey: "unit",
      header: "Unit",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.unit || "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "success" : "secondary"} className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        const isActive = product.status === "active";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setEditingProduct(product);
                  setIsFormOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit product
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isActive ? (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setProductToDeactivate(product)}
                >
                  <PowerOff className="mr-2 h-4 w-4" /> Deactivate product
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleReactivate(product)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reactivate product
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const isFiltered = !!search || statusFilter !== "active" || groupFilter !== ALL_GROUPS;

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-muted-foreground">
      <Package className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="text-base font-medium text-foreground">
        {isFiltered ? "No products found" : "No products yet"}
      </p>
      <p className="mb-4 text-sm">
        {isFiltered
          ? "We couldn't find any products matching your criteria."
          : canManage
            ? "Add your first product to start building your catalog."
            : "No products have been added to this catalog yet."}
      </p>
      {canManage && !isFiltered && (
        <Button size="sm" onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" /> Add product
        </Button>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-muted-foreground">Manage your product catalog</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsGroupsDialogOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Manage groups
            </Button>
            <Button size="sm" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center justify-between space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:space-y-0">
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="bg-muted/40 pl-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select value={groupFilter} onValueChange={(value) => value && setGroupFilter(value)}>
            <SelectTrigger className="w-full bg-muted/40 sm:w-[190px]">
              <SelectValue placeholder="Product group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.status === "inactive" ? `${group.name} (Inactive)` : group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-full bg-muted/40 sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 rounded-xl bg-muted p-1">
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="icon"
            aria-label="Table view"
            aria-pressed={view === "table"}
            className={`h-8 w-8 rounded-lg ${view === "table" ? "shadow-sm" : ""}`}
            onClick={() => setView("table")}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "default" : "ghost"}
            size="icon"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`h-8 w-8 rounded-lg ${view === "grid" ? "shadow-sm" : ""}`}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loadState === "loading" && <TableSkeleton rows={PAGE_SIZE} />}

      {loadState === "error" && (
        <ErrorState
          title="Couldn't load products"
          description={loadErrorMessage}
          onRetry={loadProducts}
        />
      )}

      {loadState === "ready" && (
        <AnimatePresence mode="wait">
          {view === "table" ? (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/40">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-64 text-center">
                          {emptyState}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t px-6 py-4">
                <span className="text-sm text-muted-foreground">
                  Showing {products.length} of {total} results
                </span>
                <div className="flex space-x-2">
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
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden rounded-xl transition-shadow hover:shadow-md"
                >
                  <div className="relative flex h-40 items-center justify-center bg-muted p-6">
                    <Badge variant="secondary" className="absolute top-4 left-4">
                      {product.productGroup.name}
                    </Badge>
                    <Badge
                      variant={product.status === "active" ? "success" : "secondary"}
                      className="absolute top-4 right-4 capitalize"
                    >
                      {product.status}
                    </Badge>
                    <Package className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                  <CardContent className="p-5">
                    <h3 className="mb-1 truncate font-semibold text-foreground">{product.name}</h3>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.unit || product.sku || "—"}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${product.name}`}
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingProduct(product);
                            setIsFormOpen(true);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products.length === 0 && (
                <div className="col-span-full flex flex-col items-center rounded-xl border bg-card py-16 text-center shadow-sm">
                  {emptyState}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <ProductForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={editingProduct}
        onSubmit={handleFormSubmit}
        canManageGroups={canManage}
        onManageGroups={() => setIsGroupsDialogOpen(true)}
      />

      {canManage && (
        <ProductGroupsDialog
          open={isGroupsDialogOpen}
          onOpenChange={setIsGroupsDialogOpen}
          onChanged={() => {
            void loadGroups();
            void loadProducts();
          }}
          onUnauthorized={handleUnauthorized}
        />
      )}

      <AlertDialog
        open={!!productToDeactivate}
        onOpenChange={(open) => !open && !isDeactivating && setProductToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{productToDeactivate?.name}</strong> as inactive. It stays in
              your catalog and can be reactivated at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
              disabled={isDeactivating}
              onClick={handleDeactivate}
            >
              {isDeactivating ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
