"use client";

import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CrmUserRole, ROLE_LABELS } from "./types";

type AccessLevel = "full" | "limited" | "view" | "none";

interface MatrixRow {
  module: string;
  access: Record<CrmUserRole, AccessLevel>;
}

const roles: CrmUserRole[] = ["super-admin", "admin", "sales-executive"];

const matrix: MatrixRow[] = [
  { module: "Users Management", access: { "super-admin": "full", admin: "limited", "sales-executive": "none" } },
  { module: "Clients", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Products", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Enquiries", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Follow-ups", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Quotations", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Sales", access: { "super-admin": "full", admin: "full", "sales-executive": "full" } },
  { module: "Reports", access: { "super-admin": "full", admin: "full", "sales-executive": "view" } },
  { module: "Analytics", access: { "super-admin": "full", admin: "full", "sales-executive": "view" } },
  { module: "Settings", access: { "super-admin": "full", admin: "limited", "sales-executive": "none" } },
];

function AccessCell({ level }: { level: AccessLevel }) {
  if (level === "full") {
    return (
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
      </div>
    );
  }
  if (level === "limited") {
    return (
      <div className="flex items-center justify-center gap-0.5 mx-auto w-fit">
        <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-amber-700" strokeWidth={3} />
        </div>
        <span className="text-amber-700 text-xs font-semibold">*</span>
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

export function PermissionsMatrix() {
  return (
    <div className="space-y-3 mt-4">
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="min-w-[160px] font-bold">Module</TableHead>
                {roles.map((role) => (
                  <TableHead key={role} className="text-center font-bold min-w-[140px]">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row, i) => (
                <TableRow key={row.module} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                  <TableCell className="font-medium">{row.module}</TableCell>
                  {roles.map((role) => (
                    <TableCell key={`${row.module}-${role}`} className="text-center h-14">
                      <AccessCell level={row.access[role]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground px-1">
        <Check className="inline h-3 w-3 text-primary mb-0.5" strokeWidth={3} /> Full access &nbsp;·&nbsp;
        <span className="text-amber-700 font-semibold">✓*</span> Limited access &nbsp;·&nbsp;
        <span className="font-medium">View</span> View-only &nbsp;·&nbsp;
        <Minus className="inline h-3 w-3 mb-0.5" /> No access. This is a frontend-only representation — actual authorization will be enforced by the backend.
      </p>
    </div>
  );
}
