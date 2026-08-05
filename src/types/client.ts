import { type ID, type Status, type Address, type TimelineEvent, type Attachment } from "./common";

export interface Contact {
  id: ID;
  name: string;
  email: string;
  phone: string;
  designation: string;
  isPrimary: boolean;
  avatar?: string;
}

export interface Client {
  id: ID;
  companyName: string;
  industry: string;
  website?: string;
  email: string;
  phone: string;
  gstNumber?: string;
  status: Status;
  tags: string[];
  contacts: Contact[];
  address: Address;
  logo?: string;
  notes?: string;
  totalDeals: number;
  totalRevenue: number;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
}

export type ClientFormData = Omit<Client, "id" | "totalDeals" | "totalRevenue" | "lastActivity" | "createdAt" | "updatedAt">;

export interface ClientActivity extends TimelineEvent {
  clientId: ID;
}

export interface ClientDocument extends Attachment {
  clientId: ID;
  category: "contract" | "proposal" | "invoice" | "other";
}

export const INDUSTRIES = [
  "Information Technology",
  "Manufacturing",
  "Healthcare",
  "Finance & Banking",
  "Real Estate",
  "Education",
  "Retail & E-commerce",
  "Automobile",
  "Pharmaceuticals",
  "Telecommunications",
  "Energy & Utilities",
  "Media & Entertainment",
  "Agriculture",
  "Hospitality",
  "Logistics & Transportation",
  "Construction",
  "Textiles",
  "Food & Beverage",
  "Legal Services",
  "Consulting",
] as const;

export const CLIENT_TAGS = [
  "Enterprise",
  "SMB",
  "Startup",
  "Government",
  "VIP",
  "Prospect",
  "Long-term",
  "New",
  "Referral",
  "Key Account",
] as const;
