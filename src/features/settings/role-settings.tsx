"use client";

import { PermissionsMatrix } from "@/features/users/permissions-matrix";

export function RoleSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Roles & Permissions</h2>
        <p className="text-sm text-muted-foreground">
          What each of SevenCRM&apos;s three fixed roles can currently do.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <PermissionsMatrix />
    </div>
  );
}
