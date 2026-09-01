/**
 * Data layer for the Products feature: talks to the real NestJS backend
 * (/products and /product-groups) and maps its responses onto the frontend
 * `Product` / `ProductGroup` types (src/types/product.ts) so no component
 * needs to know the backend's shape — mirrors src/features/clients/api.ts.
 *
 * Product Groups are organization-defined data loaded from the backend.
 * There are deliberately no hardcoded categories or units anywhere here.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { Product, ProductGroup, ProductStatus } from "@/types/product";

export type BackendStatus = "ACTIVE" | "INACTIVE";

/** Mirrors SafeProductGroup in backend/src/product-groups/product-groups.service.ts. */
export interface BackendProductGroup {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: BackendStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors SafeProduct in backend/src/products/products.service.ts. */
export interface BackendProduct {
  id: string;
  organizationId: string;
  productGroupId: string;
  productGroup: { id: string; name: string };
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  unit: string | null;
  status: BackendStatus;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filter value used by the list UIs; "all" means "don't send a status filter". */
export type StatusFilter = ProductStatus | "all";

// ---------------------------------------------------------------------------
// Mapping. The backend uses UPPER_SNAKE status enums and `null` for absent
// optional strings; the frontend uses lowercase status and "" so the values
// can be bound straight to form inputs (same convention as toClientRecord).
// ---------------------------------------------------------------------------

function toStatus(status: BackendStatus): ProductStatus {
  return status === "INACTIVE" ? "inactive" : "active";
}

function toBackendStatus(status: ProductStatus): BackendStatus {
  return status === "inactive" ? "INACTIVE" : "ACTIVE";
}

export function toProductGroup(group: BackendProductGroup): ProductGroup {
  return {
    id: group.id,
    organizationId: group.organizationId,
    name: group.name,
    description: group.description ?? "",
    status: toStatus(group.status),
    productCount: group.productCount,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function toProduct(product: BackendProduct): Product {
  return {
    id: product.id,
    organizationId: product.organizationId,
    productGroupId: product.productGroupId,
    productGroup: product.productGroup,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    sku: product.sku ?? "",
    unit: product.unit ?? "",
    status: toStatus(product.status),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Error wording. The shared helper's 404/409 text is user-account specific
// ("That user could not be found."), so both resources get their own — same
// reason Clients and Enquiries each define one.
// ---------------------------------------------------------------------------

export function getProductErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That product could not be found.";
    if (error.status === 409) return error.message || "This conflicts with an existing product.";
  }
  return getFriendlyErrorMessage(error);
}

export function getProductGroupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That product group could not be found.";
    if (error.status === 409) {
      return error.message || "A product group with this name already exists in your organization.";
    }
  }
  return getFriendlyErrorMessage(error);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Product Groups
// ---------------------------------------------------------------------------

export interface ListProductGroupsParams {
  search?: string;
  status?: StatusFilter;
  page?: number;
  pageSize?: number;
}

export async function listProductGroups(
  params: ListProductGroupsParams = {},
): Promise<PaginatedResult<ProductGroup>> {
  const qs = buildQuery({
    search: params.search,
    status: params.status && params.status !== "all" ? toBackendStatus(params.status) : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const result = await apiFetch<BackendPaginated<BackendProductGroup>>(`/product-groups${qs}`);
  return { ...result, data: result.data.map(toProductGroup) };
}

export interface ProductGroupPayload {
  name: string;
  description?: string;
}

export async function createProductGroup(payload: ProductGroupPayload): Promise<ProductGroup> {
  const group = await apiFetch<BackendProductGroup>("/product-groups", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      // Omitted rather than sent as "" so a group created without a
      // description is stored as NULL.
      description: payload.description || undefined,
    }),
  });
  return toProductGroup(group);
}

export async function updateProductGroup(
  id: string,
  payload: ProductGroupPayload,
): Promise<ProductGroup> {
  const group = await apiFetch<BackendProductGroup>(`/product-groups/${id}`, {
    method: "PATCH",
    // description is sent as-is (including "") so clearing it actually clears it.
    body: JSON.stringify({ name: payload.name, description: payload.description ?? "" }),
  });
  return toProductGroup(group);
}

export async function updateProductGroupStatus(
  id: string,
  status: ProductStatus,
): Promise<ProductGroup> {
  const group = await apiFetch<BackendProductGroup>(`/product-groups/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });
  return toProductGroup(group);
}

/**
 * Loads the groups a product may be assigned to. Only ACTIVE groups are
 * selectable — the backend rejects assigning a product to an inactive group
 * (400), so offering one would be a guaranteed failure.
 */
export async function listAssignableProductGroups(): Promise<ProductGroup[]> {
  const result = await listProductGroups({ status: "active", pageSize: 100 });
  return result.data;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ListProductsParams {
  search?: string;
  productGroupId?: string;
  status?: StatusFilter;
  page?: number;
  pageSize?: number;
}

export async function listProducts(
  params: ListProductsParams = {},
): Promise<PaginatedResult<Product>> {
  const qs = buildQuery({
    search: params.search,
    productGroupId: params.productGroupId,
    status: params.status && params.status !== "all" ? toBackendStatus(params.status) : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const result = await apiFetch<BackendPaginated<BackendProduct>>(`/products${qs}`);
  return { ...result, data: result.data.map(toProduct) };
}

export async function getProduct(id: string): Promise<Product> {
  return toProduct(await apiFetch<BackendProduct>(`/products/${id}`));
}

export interface CreateProductPayload {
  name: string;
  productGroupId: string;
  description?: string;
  price: number;
  sku?: string;
  unit?: string;
}

/**
 * `status` is deliberately absent: the backend always creates a product
 * ACTIVE and exposes status only through PATCH /products/:id/status.
 */
export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const product = await apiFetch<BackendProduct>("/products", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      productGroupId: payload.productGroupId,
      // Optional strings are omitted when blank so they're stored as NULL
      // rather than "".
      description: payload.description || undefined,
      price: payload.price,
      sku: payload.sku || undefined,
      unit: payload.unit || undefined,
    }),
  });
  return toProduct(product);
}

export interface UpdateProductPayload {
  name: string;
  /**
   * Only set when the user actually picked a different group. Left undefined
   * (and therefore omitted from the request) otherwise, so editing a product
   * whose group has since been deactivated never re-sends — and never gets
   * rejected by — that inactive group id.
   */
  productGroupId?: string;
  description?: string;
  price: number;
  sku?: string;
  unit?: string;
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const product = await apiFetch<BackendProduct>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: payload.name,
      ...(payload.productGroupId !== undefined ? { productGroupId: payload.productGroupId } : {}),
      // Sent as-is (including "") so clearing a field actually clears it.
      description: payload.description ?? "",
      price: payload.price,
      sku: payload.sku ?? "",
      unit: payload.unit ?? "",
    }),
  });
  return toProduct(product);
}

export async function updateProductStatus(id: string, status: ProductStatus): Promise<Product> {
  const product = await apiFetch<BackendProduct>(`/products/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });
  return toProduct(product);
}

/**
 * Permanent removal — distinct from updateProductStatus('inactive'), which
 * keeps the record. The backend rejects this with a 409 (surfaced via
 * getProductErrorMessage) if the product is still referenced by any
 * enquiry or quotation.
 */
export async function deleteProduct(id: string): Promise<void> {
  await apiFetch<{ id: string }>(`/products/${id}`, { method: "DELETE" });
}
