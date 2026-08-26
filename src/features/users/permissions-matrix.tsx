"use client";

import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CrmUserRole, ROLE_LABELS } from "./types";

type AccessLevel = "full" | "limited" | "view" | "none";

interface MatrixRow {
  module: string;
  access: Record<CrmUserRole, AccessLevel>;
  /** Row-level nuance that a single access level can't express on its own. */
  note?: string;
}

const roles: CrmUserRole[] = ["super-admin", "admin", "sales-executive"];

/**
 * Sourced directly from each module's own backend authorization rules
 * (assertCanRead/assertCanManage-style checks in every *.service.ts) — not
 * from this page's own opinion. Every row below was verified against the
 * actual current backend code before being written here; when the backend
 * changes a rule, this table can go stale, since nothing wires it to the
 * backend live (see the disclaimer below the table).
 */
const crmMatrix: MatrixRow[] = [
  {
    module: "Users Management",
    access: { "super-admin": "full", admin: "limited", "sales-executive": "none" },
    note: "Admin can view and manage users but cannot assign roles or create a Super Admin — only a Super Admin can.",
  },
  { module: "Clients", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Enquiries", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  {
    module: "Products & Product Groups",
    access: { "super-admin": "full", admin: "full", "sales-executive": "view" },
  },
  {
    module: "Quotations",
    access: { "super-admin": "full", admin: "full", "sales-executive": "view" },
  },
  { module: "Follow-ups", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  {
    module: "Tasks",
    access: { "super-admin": "full", admin: "full", "sales-executive": "full" },
    note: "A Sales Executive's own tasks only — not their teammates'.",
  },
  {
    module: "Sales / Reports / Analytics",
    access: { "super-admin": "view", admin: "view", "sales-executive": "view" },
  },
  { module: "Search", access: { "super-admin": "view", admin: "view", "sales-executive": "view" } },
  { module: "Notifications", access: { "super-admin": "view", admin: "view", "sales-executive": "view" } },
];

const settingsMatrix: MatrixRow[] = [
  { module: "Company Profile", access: { "super-admin": "full", admin: "full", "sales-executive": "view" } },
  { module: "Branding", access: { "super-admin": "full", admin: "full", "sales-executive": "view" } },
  { module: "Tax Rates", access: { "super-admin": "full", admin: "full", "sales-executive": "view" } },
  {
    module: "Email Templates",
    access: { "super-admin": "full", admin: "full", "sales-executive": "none" },
  },
  {
    module: "Audit Logs",
    access: { "super-admin": "view", admin: "view", "sales-executive": "view" },
    note: "A Sales Executive sees only their own actions — Super Admin and Admin see the whole organization.",
  },
  { module: "Roles & Permissions (this page)", access: { "super-admin": "view", admin: "view", "sales-executive": "view" } },
];

function AccessCell({ level }: { level: AccessLevel }) {
  if (level === "full") {
    return (
      <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
      </div>
    );
  }
  if (level === "limited") {
    return (
      <div className="mx-auto flex w-fit items-center justify-center gap-0.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
          <Check className="h-3.5 w-3.5 text-amber-700" strokeWidth={3} />
        </div>
        <span className="text-xs font-semibold text-amber-700">*</span>
      </div>
    );
  }
  if (level === "view") {
    return <span className="text-xs font-medium text-muted-foreground">View</span>;
  }
  return (
    <div className="flex items-center justify-center">
      <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
    </div>
  );
}

function MatrixTable({ rows }: { rows: MatrixRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[220px] font-bold">Module</TableHead>
              {roles.map((role) => (
                <TableHead key={role} className="min-w-[140px] text-center font-bold">
                  {ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.module} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                <TableCell>
                  <div className="font-medium">{row.module}</div>
                  {row.note && <div className="mt-0.5 text-xs text-muted-foreground">{row.note}</div>}
                </TableCell>
                {roles.map((role) => (
                  <TableCell key={`${row.module}-${role}`} className="h-14 text-center">
                    <AccessCell level={row.access[role]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function PermissionsMatrix() {
  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CRM</p>
        <MatrixTable rows={crmMatrix} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
        <MatrixTable rows={settingsMatrix} />
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        <Check className="mb-0.5 inline h-3 w-3 text-primary" strokeWidth={3} /> Full access &nbsp;·&nbsp;
        <span className="font-semibold text-amber-700">✓*</span> Limited access (see note) &nbsp;·&nbsp;
        <span className="font-medium">View</span> View-only &nbsp;·&nbsp;
        <Minus className="mb-0.5 inline h-3 w-3" /> No access.
      </p>
      <p className="px-1 text-xs text-muted-foreground">
        SevenCRM currently supports exactly these three fixed roles — there is no custom or granular
        per-user permission system. This table mirrors what each backend module actually enforces today;
        it is a reference only and has no controls of its own to create roles, edit permissions, or save
        changes here.
      </p>
    </div>
  );
}
