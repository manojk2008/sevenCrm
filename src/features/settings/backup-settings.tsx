"use client";

import { Download, HardDrive, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockBackups = [
  { id: 1, date: "2024-03-15 02:00", size: "45.2 MB", type: "Auto", status: "Success" },
  { id: 2, date: "2024-03-14 02:00", size: "44.8 MB", type: "Auto", status: "Success" },
  { id: 3, date: "2024-03-13 14:30", size: "44.5 MB", type: "Manual", status: "Success" },
];

export function BackupSettings() {
  const handleBackup = () => {
    toast.info("Manual backup started. This may take a few minutes.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold">Backup & Restore</h3>
          <p className="text-sm text-muted-foreground">
            Manage your data backups to ensure business continuity.
          </p>
        </div>
        <Button onClick={handleBackup} className="rounded-xl">
          <HardDrive className="mr-2 h-4 w-4" /> Start Manual Backup
        </Button>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Last Automated Backup</p>
            <p className="text-xl font-bold">Today, 02:00 AM</p>
          </div>
        </div>
        <div className="bg-muted/50 border p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-background text-muted-foreground rounded-xl shadow-sm">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Backup Size</p>
            <p className="text-xl font-bold">134.5 MB</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-4 text-lg">Backup History</h4>
        <div className="border rounded-2xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockBackups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{backup.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{backup.type}</Badge>
                  </TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-500 hover:bg-green-600">{backup.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="rounded-lg">
                      <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
