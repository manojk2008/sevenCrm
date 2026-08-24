import { Enquiry } from "@/types/enquiry";

// Enquiry.products is a real EnquiryProduct[] resolved from the backend's
// Product records — no product names are invented here.

export const mockEnquiries: Enquiry[] = [
  {
    id: "e1",
    title: "ERP Implementation for Acme Corp",
    clientId: "c1",
    clientName: "John Doe",
    clientCompany: "Acme Corp",
    stage: "new",
    expectedRevenue: 1500000,
    probability: 10,
    priority: "high",
    source: "website",
    assignedTo: "u1",
    assignedToName: "Rahul Sharma",
    products: [],
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    attachments: [],
    timeline: [],
    tags: []
  },
  {
    id: "e2",
    title: "CRM Migration for Stark Industries",
    clientId: "c2",
    clientName: "Tony Stark",
    clientCompany: "Stark Industries",
    stage: "negotiation",
    expectedRevenue: 5500000,
    probability: 80,
    priority: "urgent",
    source: "referral",
    assignedTo: "u2",
    assignedToName: "Priya Patel",
    products: [],
    expectedCloseDate: new Date(Date.now() + 10 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    attachments: [],
    timeline: [],
    tags: []
  },
  {
    id: "e3",
    title: "Custom App Development",
    clientId: "c3",
    clientName: "Bruce Wayne",
    clientCompany: "Wayne Ent",
    stage: "contacted",
    expectedRevenue: 800000,
    probability: 30,
    priority: "medium",
    source: "cold-call",
    assignedTo: "u1",
    assignedToName: "Rahul Sharma",
    products: [],
    expectedCloseDate: new Date(Date.now() + 45 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    attachments: [],
    timeline: [],
    tags: []
  }
];
