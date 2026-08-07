import { type ID, type Status } from "./common";

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface Product {
  id: ID;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  unit: string;
  sku: string;
  status: Status;
  images: string[];
  specifications: ProductSpecification[];
  hsnCode?: string;
  gstRate: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt">;

export const PRODUCT_CATEGORIES = [
  "Software Solutions",
  "Hardware",
  "Cloud Services",
  "Consulting",
  "Training",
  "Support & Maintenance",
  "Networking",
  "Security",
  "Data Analytics",
  "Custom Development",
  "IoT Solutions",
  "AI & ML Services",
] as const;


export const PRODUCT_UNITS = [
  "Per License",
  "Per User",
  "Per Month",
  "Per Year",
  "Per Unit",
  "Per Hour",
  "Per Project",
  "Per GB",
] as const;
