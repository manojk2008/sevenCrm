"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENQUIRY_SOURCES } from "@/types/enquiry";

// Will use react-hook-form in production — this is still a visual-only
// pass; no state, validation, or submit handler is wired up yet (QA-007).

interface EnquiryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnquiryForm({ open, onOpenChange }: EnquiryFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add enquiry</DialogTitle>
          <DialogDescription>Log a new sales enquiry and track it through your pipeline.</DialogDescription>
        </DialogHeader>

        <div style={{ padding: '20px 24px' }}>
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Enquiry details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="enq-title">Title *</Label>
                <Input id="enq-title" placeholder="e.g. ERP Implementation for ABC Corp" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="enq-client">Client *</Label>
                <Select>
                  <SelectTrigger id="enq-client">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c1">Acme Corp</SelectItem>
                    <SelectItem value="c2">Stark Industries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enq-revenue">Expected revenue (₹)</Label>
                <Input id="enq-revenue" type="number" placeholder="500000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enq-probability">Probability (%)</Label>
                <Input id="enq-probability" type="number" min={0} max={100} placeholder="50" />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Classification</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="space-y-2">
                <Label htmlFor="enq-priority">Priority</Label>
                <Select defaultValue="medium">
                  <SelectTrigger id="enq-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enq-source">Source</Label>
                <Select>
                  <SelectTrigger id="enq-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENQUIRY_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="enq-close-date">Expected close date</Label>
                <Input id="enq-close-date" type="date" />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="space-y-2">
              <Label htmlFor="enq-description">Description</Label>
              <Textarea id="enq-description" placeholder="Requirements details..." className="resize-none" rows={3} />
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-background py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button>Save enquiry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}