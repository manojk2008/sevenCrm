"use client";

import { Filter, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const generateMockLogs = () => {
  const actions = ["Created", "Updated", "Deleted", "Logged In"];
  const entities = ["Client", "Quotation", "User", "System"];
  const users = [
    { name: "Ravi Kumar", initials: "RK" },
    { name: "Priya Singh", initials: "PS" },
    { name: "System", initials: "SY" }
  ];

  return Array.from({ length: 30 }).map((_, i) => {
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const entity = entities[Math.floor(Math.random() * entities.length)];
    
    const date = new Date();
    date.setHours(date.getHours() - (i * 2 + Math.floor(Math.random() * 5)));

    return {
      id: `log-${i}`,
      timestamp: date,
      user,
      action,
      entity,
      details: `${action} ${entity} #${Math.floor(1000 + Math.random() * 9000)}`
    };
  });
};

const mockLogs = generateMockLogs();

export function AuditLogSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">
            Track user activities and system changes.
          </p>
        </div>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." className="pl-8 rounded-xl" />
        </div>
        <Button variant="outline" className="rounded-xl">
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                        {log.user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{log.user.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    log.action === "Created" ? "bg-green-100 text-green-700" :
                    log.action === "Deleted" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{log.entity}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
