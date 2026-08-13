"use client";

import { useState } from "react";
import { Edit, MoreHorizontal, UserCheck, UserX, Users as UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { CrmUser, ROLE_BADGE_CLASSES, ROLE_LABELS } from "./types";

interface UserTableProps {
  users: CrmUser[];
  onEdit: (user: CrmUser) => void;
  onToggleStatus: (user: CrmUser) => void;
}

export function UserTable({ users, onEdit, onToggleStatus }: UserTableProps) {
  const [viewingUser, setViewingUser] = useState<CrmUser | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CrmUser | null>(null);

  return (
    <>
      <div className="border rounded-2xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <UsersIcon className="h-8 w-8 mb-2 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No users found</p>
                    <p className="text-sm">Try adjusting your search or filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const canManage = user.role !== "super-admin";
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE_CLASSES[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === "active" ? "default" : "secondary"}
                        className={user.status === "active" ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        {user.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.lastActive}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => setViewingUser(user)}>
                            View User
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit User
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem
                              className={
                                user.status === "active"
                                  ? "cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                  : "cursor-pointer"
                              }
                              onClick={() => setConfirmTarget(user)}
                            >
                              {user.status === "active" ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" /> Disable User
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" /> Enable User
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Read-only overview of this team member.</DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-base">
                    {getInitials(viewingUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{viewingUser.name}</p>
                  <p className="text-sm text-muted-foreground">{viewingUser.email}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-y-3 text-sm border-t pt-4">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <Badge variant="outline" className={ROLE_BADGE_CLASSES[viewingUser.role]}>
                    {ROLE_LABELS[viewingUser.role]}
                  </Badge>
                </dd>
                <dt className="text-muted-foreground">Department</dt>
                <dd>{viewingUser.department}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant={viewingUser.status === "active" ? "default" : "secondary"}
                    className={viewingUser.status === "active" ? "bg-green-500 hover:bg-green-600" : ""}
                  >
                    {viewingUser.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </dd>
                <dt className="text-muted-foreground">Last Active</dt>
                <dd>{viewingUser.lastActive}</dd>
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.status === "active" ? "Disable this user?" : "Enable this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.status === "active"
                ? <>Disable <strong>{confirmTarget?.name}</strong>? They will no longer be able to access the CRM.</>
                : <>Re-enable <strong>{confirmTarget?.name}</strong>? They will regain access to the CRM.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmTarget?.status === "active" ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : ""}
              onClick={() => {
                if (confirmTarget) onToggleStatus(confirmTarget);
                setConfirmTarget(null);
              }}
            >
              {confirmTarget?.status === "active" ? "Disable" : "Enable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
