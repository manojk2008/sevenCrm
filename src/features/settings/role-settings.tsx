"use client";

import { PermissionsMatrix } from "@/features/users/permissions-matrix";

export function RoleSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">Roles & Permissions</h3>
        <p className="text-sm text-muted-foreground">
          Define access levels for different roles in your organization.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <PermissionsMatrix />
    </div>
  );
}
