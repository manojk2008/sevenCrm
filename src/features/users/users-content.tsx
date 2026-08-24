"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ApiError, getFriendlyErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { PermissionsMatrix } from "./permissions-matrix";
import { UserForm, UserFormValues } from "./user-form";
import { UserTable } from "./user-table";
import { createUser, listUsers, updateUser, updateUserStatus } from "./api";
import { CrmUser, CrmUserRole, DEPARTMENTS, ROLE_LABELS } from "./types";

type RoleFilter = "all" | CrmUserRole;
type StatusFilter = "all" | "active" | "inactive";
type DepartmentFilter = "all" | (typeof DEPARTMENTS)[number];
type LoadState = "loading" | "error" | "ready";

export function UsersContent() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSuperAdmin = currentUser?.role === "super-admin";

  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CrmUser | undefined>(undefined);

  // A 401 means the session is gone (expired/signed out elsewhere) — the
  // backend is authoritative, so we clear local state and send the user
  // back to login rather than leaving a stale "authenticated" UI showing.
  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const loadUsers = useCallback(async () => {
    setLoadState("loading");
    try {
      const data = await listUsers();
      setUsers(data);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getFriendlyErrorMessage(error));
      setLoadState("error");
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const activeFilterCount = [roleFilter, statusFilter, departmentFilter].filter((v) => v !== "all").length;

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        ROLE_LABELS[user.role].toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter;
      return matchesQuery && matchesRole && matchesStatus && matchesDepartment;
    });
  }, [users, searchQuery, roleFilter, statusFilter, departmentFilter]);

  const handleFormSubmit = async (values: UserFormValues) => {
    if (editingUser) {
      await updateUser(editingUser.id, {
        name: values.name,
        role: values.role,
        department: values.department,
      });
    } else {
      await createUser({
        name: values.name,
        email: values.email,
        password: values.password ?? "",
        role: values.role,
        department: values.department,
      });
    }
    await loadUsers();
  };

  const handleToggleStatus = async (user: CrmUser) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    try {
      await updateUserStatus(user.id, nextStatus);
      await loadUsers();
      toast.success(nextStatus === "active" ? `${user.name} has been enabled` : `${user.name} has been disabled`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage team members and permissions</p>
        </div>

        {isSuperAdmin && (
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditingUser(undefined);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Create User
          </Button>
        )}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="users" className="rounded-lg">All Users</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg">Permissions Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 m-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8 rounded-xl bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="icon" aria-label="Filter users" className="rounded-xl relative">
                    <Filter className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-64 rounded-xl">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="super-admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="sales-executive">Sales Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                    <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as DepartmentFilter)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setRoleFilter("all");
                        setStatusFilter("all");
                        setDepartmentFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {loadState === "loading" && <TableSkeleton rows={5} />}

          {loadState === "error" && (
            <ErrorState
              title="Couldn't load users"
              description={loadErrorMessage}
              onRetry={loadUsers}
            />
          )}

          {loadState === "ready" && (
            <UserTable
              users={filteredUsers}
              onEdit={(user) => {
                setEditingUser(user);
                setIsFormOpen(true);
              }}
              onToggleStatus={handleToggleStatus}
            />
          )}
        </TabsContent>

        <TabsContent value="permissions" className="m-0">
          <PermissionsMatrix />
        </TabsContent>
      </Tabs>

      <UserForm open={isFormOpen} onOpenChange={setIsFormOpen} user={editingUser} onSubmit={handleFormSubmit} />
    </div>
  );
}
