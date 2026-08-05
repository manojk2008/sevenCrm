"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check } from "lucide-react";

const modules = [
  "Dashboard", "Clients", "Products", "Enquiries", 
  "Follow-ups", "Quotations", "Sales", "Reports", 
  "Analytics", "Users", "Settings"
];

const roles = ["Super Admin", "Admin", "Sales Manager", "Sales Executive"];

// Helper to determine if a role has permission (mock logic)
const hasPermission = (moduleName: string, action: string, role: string) => {
  if (role === "Super Admin") return true;
  
  if (role === "Admin") {
    if (moduleName === "Settings" && action === "Delete") return false;
    return true;
  }
  
  if (role === "Sales Manager") {
    if (["Users", "Settings"].includes(moduleName)) return false;
    if (action === "Delete" && ["Products", "Clients"].includes(moduleName)) return false;
    return true;
  }
  
  if (role === "Sales Executive") {
    if (["Users", "Settings", "Analytics", "Reports", "Products"].includes(moduleName)) {
      if (moduleName === "Products" && action === "View") return true;
      return false;
    }
    if (action === "Delete") return false;
    if (moduleName === "Sales" && action === "Create") return false; // usually auto-created from quota
    return true;
  }
  
  return false;
};

const actions = ["View", "Create", "Edit", "Delete"];

export function PermissionsMatrix() {
  return (
    <div className="border rounded-2xl overflow-hidden bg-card mt-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[150px] font-bold border-r">Module</TableHead>
              {roles.map((role) => (
                <TableHead key={role} className="text-center border-r font-bold min-w-[200px]" colSpan={4}>
                  {role}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableHead className="border-r"></TableHead>
              {roles.map((role) => (
                <text key={`sub-${role}`} className="contents">
                  {actions.map(action => (
                    <TableHead key={`${role}-${action}`} className="text-center text-xs w-[50px] px-1 border-r last:border-r-0">
                      {action}
                    </TableHead>
                  ))}
                </text>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((moduleName, i) => (
              <TableRow key={moduleName} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                <TableCell className="font-medium border-r">{moduleName}</TableCell>
                {roles.map((role) => (
                  <text key={`cell-${moduleName}-${role}`} className="contents">
                    {actions.map((action, j) => {
                      const permitted = hasPermission(moduleName, action, role);
                      return (
                        <TableCell key={`${role}-${action}-${j}`} className="text-center p-0 border-r last:border-r-0 h-12">
                          <div className="flex items-center justify-center h-full w-full">
                            {permitted ? (
                              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded bg-muted/20 border border-muted flex items-center justify-center">
                                {/* empty checkbox */}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </text>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
