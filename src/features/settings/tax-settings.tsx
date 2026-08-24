"use client";

import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const initialTaxes = [
  { id: 1, name: "CGST", rate: 9, description: "Central GST", status: "Active" },
  { id: 2, name: "SGST", rate: 9, description: "State GST", status: "Active" },
  { id: 3, name: "IGST", rate: 18, description: "Integrated GST", status: "Active" },
  { id: 4, name: "Service Tax", rate: 15, description: "Old Service Tax", status: "Inactive" },
];

export function TaxSettings() {
  const [taxes, setTaxes] = useState(initialTaxes);

  const handleDelete = (id: number) => {
    setTaxes(taxes.filter(t => t.id !== id));
    toast.success("Tax rate deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tax Rates</h2>
          <p className="text-sm text-muted-foreground">
            Manage tax rates applied to your products and quotations.
          </p>
        </div>
        <Button className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" /> Add Tax Rate
        </Button>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Tax Name</TableHead>
              <TableHead>Rate (%)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxes.map((tax) => (
              <TableRow key={tax.id}>
                <TableCell className="font-medium">{tax.name}</TableCell>
                <TableCell>{tax.rate}%</TableCell>
                <TableCell className="text-muted-foreground">{tax.description}</TableCell>
                <TableCell>
                  <Badge variant={tax.status === "Active" ? "default" : "secondary"} className={tax.status === "Active" ? "bg-green-500 hover:bg-green-600" : ""}>
                    {tax.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" aria-label="Edit tax rate" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete tax rate" onClick={() => handleDelete(tax.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {taxes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No tax rates configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
