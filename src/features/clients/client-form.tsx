"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isValidGSTINFormat } from "@/lib/gst";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface ClientRecord {
  id: string;
  name: string;
  contactperson: string;
  email: string;
  phone: string;
  website?: string;
  gstNumber?: string;
  status: "active" | "inactive";
  tags: string[];
  revenue: number;
  lastActivity: string;
  primaryContact: {
    name: string;
    email: string;
    phone: string;
    designation?: string;
  };
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  notes?: string;
}

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRecord;
  onSubmit: (client: ClientRecord) => void;
}

const emptyClient = (): ClientRecord => ({
  id: "",
  name: "",
  contactperson: "",
  email: "",
  phone: "",
  website: "",
  gstNumber: "",
  status: "active",
  tags: ["New"],
  revenue: 0,
  lastActivity: new Date().toISOString(),
  primaryContact: { name: "", email: "", phone: "", designation: "" },
  address: { line1: "", city: "", state: "", pincode: "", country: "India" },
  notes: "",
});

export function ClientForm({ open, onOpenChange, client, onSubmit }: ClientFormProps) {
  const [value, setValue] = useState<ClientRecord>(client ?? emptyClient());

  useEffect(() => {
    if (open) setValue(client ?? emptyClient());
  }, [client, open]);


  const [gstStatus, setGstStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [gstMessage, setGstMessage] = useState("");

  const verifyGST = async () => {
    const gstin = value.gstNumber?.trim().toUpperCase() ?? "";
    if (!isValidGSTINFormat(gstin)) {
      setGstStatus("invalid");
      setGstMessage("Invalid GSTIN format (must be 15 characters).");
      return;
    }
    setGstStatus("checking");
    try {
      const res = await fetch(`/api/gst/verify?gstin=${gstin}`);
      const data = await res.json();
      if (!res.ok) {
        setGstStatus("invalid");
        setGstMessage(data.error ?? "Verification failed.");
        return;
      }
      setGstStatus("valid");
      setGstMessage(data.legalName ? `Verified: ${data.legalName}` : "Verified");
      // auto-fill company name if empty
      if (!value.name && data.legalName) setField("name", data.legalName);
    } catch {
      setGstStatus("invalid");
      setGstMessage("Could not reach verification service.");
    }
  };


  const setField = <K extends keyof ClientRecord>(key: K, fieldValue: ClientRecord[K]) => {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = {
      ...value,
      id: value.id || `CL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      lastActivity: new Date().toISOString(),
    };
    onSubmit(clean);
    toast.success(client ? "Client updated" : "Client created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>Keep company, contact, and billing details in one place.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} style={{ padding: '20px 24px' }}>
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Company details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Company name" required><Input value={value.name} onChange={(e) => setField("name", e.target.value)} required /></Field>
              <Field label="Contact Person" required><Input value={value.contactperson} onChange={(e) => setField("name", e.target.value)} required /></Field>
              <Field label="Company email" required><Input type="email" value={value.email} onChange={(e) => setField("email", e.target.value)} required /></Field>
              <Field label="Phone" required><Input value={value.phone} onChange={(e) => setField("phone", e.target.value)} required /></Field>
              <Field label="Website"><Input value={value.website ?? ""} onChange={(e) => setField("website", e.target.value)} /></Field>
              <Field label="GST number">
                <div className="flex gap-2">
                  <Input
                    value={value.gstNumber ?? ""}
                    onChange={(e) => {
                      setField("gstNumber", e.target.value.toUpperCase());
                      setGstStatus("idle");
                    }}
                    maxLength={15}
                    className="uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={gstStatus === "checking" || !value.gstNumber}
                    onClick={verifyGST}
                  >
                    {gstStatus === "checking" ? "Checking…" : "Verify"}
                  </Button>
                </div>
                {gstStatus === "valid" && (
                  <p className="text-xs text-emerald-600 mt-1">✓ {gstMessage}</p>
                )}
                {gstStatus === "invalid" && (
                  <p className="text-xs text-red-600 mt-1">{gstMessage}</p>
                )}
              </Field>
            </div>
          </section>
          <section className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold">Primary contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required><Input value={value.primaryContact.name} onChange={(e) => setValue((current) => ({ ...current, primaryContact: { ...current.primaryContact, name: e.target.value } }))} required /></Field>
              <Field label="Email" required><Input type="email" value={value.primaryContact.email} onChange={(e) => setValue((current) => ({ ...current, primaryContact: { ...current.primaryContact, email: e.target.value } }))} required /></Field>
              <Field label="Phone" required><Input value={value.primaryContact.phone} onChange={(e) => setValue((current) => ({ ...current, primaryContact: { ...current.primaryContact, phone: e.target.value } }))} required /></Field>
            </div>
          
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address" required className="sm:col-span-2"><Textarea value={value.address.line1} onChange={(e) => setValue((current) => ({ ...current, address: { ...current.address, line1: e.target.value } }))} required /></Field>
              <Field label="City" required><Input value={value.address.city} onChange={(e) => setValue((current) => ({ ...current, address: { ...current.address, city: e.target.value } }))} required /></Field>
              <Field label="State" required><Input value={value.address.state} onChange={(e) => setValue((current) => ({ ...current, address: { ...current.address, state: e.target.value } }))} required /></Field>
              <Field label="Pincode" required><Input value={value.address.pincode} onChange={(e) => setValue((current) => ({ ...current, address: { ...current.address, pincode: e.target.value } }))} required /></Field>
              <Field label="Notes" className="sm:col-span-2"><Textarea value={value.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} /></Field>
            </div>
          
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div><Label>Active client</Label><p className="mt-1 text-sm text-muted-foreground">Inactive clients remain available in history.</p></div>
            <Switch checked={value.status === "active"} onCheckedChange={(checked) => setField("status", checked ? "active" : "inactive")} />
          </div>
          </section>
          <DialogFooter className="sticky bottom-0 border-t bg-background py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save client</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label>{label}{required ? " *" : ""}</Label>{children}</div>;
} 