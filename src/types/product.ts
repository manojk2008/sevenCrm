import { type ID } from "./common";

/**
 * Products use their own two-value status rather than the shared `Status`
 * union in ./common, which also carries "archived" — the backend's
 * ProductStatus/ProductGroupStatus enums are ACTIVE | INACTIVE only.
 */
export type ProductStatus = "active" | "inactive";

/**
 * Organization-defined grouping for products. Groups are real backend
 * records (backend/prisma/schema.prisma → ProductGroup), never a hardcoded
 * list — every organization defines its own.
 */
export interface ProductGroup {
  id: ID;
  organizationId: string;
  name: string;
  description: string;
  status: ProductStatus;
  /** Number of products currently assigned to this group (server-computed). */
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

/** The narrowed group shape embedded in a Product response. */
export interface ProductGroupSummary {
  id: ID;
  name: string;
}

export interface Product {
  id: ID;
  organizationId: string;
  productGroupId: ID;
  productGroup: ProductGroupSummary;
  name: string;
  description: string;
  price: number;
  sku: string;
  unit: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
