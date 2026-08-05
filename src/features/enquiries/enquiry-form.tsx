"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ENQUIRY_SOURCES } from "@/types/enquiry";
// Will use react-hook-form in production

interface EnquiryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnquiryForm({ open, onOpenChange }: EnquiryFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col h-full bg-white dark:bg-slate-950">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Create New Enquiry</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-4 scrollbar-thin">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
            <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" placeholder="e.g. ERP Implementation for ABC Corp" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Client <span className="text-red-500">*</span></label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <option value="">Select a client...</option>
              <option value="c1">Acme Corp</option>
              <option value="c2">Stark Industries</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expected Revenue (₹)</label>
              <input type="number" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" placeholder="500000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Probability (%)</label>
              <input type="number" min="0" max="100" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" placeholder="50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                {ENQUIRY_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Close Date</label>
            <input type="date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background resize-none" placeholder="Requirements details..." />
          </div>
        </div>

        <SheetFooter className="pt-4 border-t mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">Save Enquiry</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
