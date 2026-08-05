"use client";

import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, Edit, UserX } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionsMatrix } from "./permissions-matrix";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockUsers = [
  { id: "1", name: "Ravi Kumar", email: "ravi@example.com", role: "Super Admin", status: "Active", department: "Management", lastActive: "2 mins ago", avatar: "RK" },
  { id: "2", name: "Priya Singh", email: "priya@example.com", role: "Admin", status: "Active", department: "Operations", lastActive: "1 hr ago", avatar: "PS" },
  { id: "3", name: "Amit Patel", email: "amit@example.com", role: "Sales Manager", status: "Active", department: "Sales", lastActive: "5 mins ago", avatar: "AP" },
  { id: "4", name: "Neha Sharma", email: "neha@example.com", role: "Sales Executive", status: "Active", department: "Sales", lastActive: "10 mins ago", avatar: "NS" },
  { id: "5", name: "Vikram Reddy", email: "vikram@example.com", role: "Sales Executive", status: "Active", department: "Sales", lastActive: "3 hrs ago", avatar: "VR" },
  { id: "6", name: "Anjali Desai", email: "anjali@example.com", role: "Sales Executive", status: "Inactive", department: "Sales", lastActive: "2 days ago", avatar: "AD" },
  { id: "7", name: "Sanjay Gupta", email: "sanjay@example.com", role: "Admin", status: "Active", department: "IT", lastActive: "1 day ago", avatar: "SG" },
  { id: "8", name: "Kavita Verma", email: "kavita@example.com", role: "Sales Executive", status: "Active", department: "Sales", lastActive: "Just now", avatar: "KV" },
];

const roleColors: Record<string, string> = {
  "Super Admin": "bg-purple-100 text-purple-800 border-purple-200",
  "Admin": "bg-blue-100 text-blue-800 border-blue-200",
  "Sales Manager": "bg-green-100 text-green-800 border-green-200",
  "Sales Executive": "bg-slate-100 text-slate-800 border-slate-200",
};

const inviteSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  role: z.string().min(1, { message: "Role is required" }),
  department: z.string().min(1, { message: "Department is required" }),
});

export function UsersContent() {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "",
      department: "",
    },
  });

  function onSubmit(values: z.infer<typeof inviteSchema>) {
    toast.success(`Invitation sent to ${values.email}`);
    setIsOpen(false);
    form.reset();
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage team members and permissions</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Invite User
              </Button>
            }
          />
          <DialogContent className="max-w-[425px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new member to your team.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                          <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sales" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full rounded-xl">Send Invitation</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

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
                {mockUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">{user.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColors[user.role]}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.department}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "Active" ? "default" : "secondary"} className={user.status === "Active" ? "bg-green-500 hover:bg-green-600" : ""}>
                        {user.status}
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
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                            <UserX className="mr-2 h-4 w-4" /> Deactivate User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="m-0">
          <PermissionsMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
