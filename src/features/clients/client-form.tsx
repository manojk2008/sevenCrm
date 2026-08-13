"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isValidGSTINFormat } from "@/lib/gst";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export interface ClientRecord {
  id: string;
  name: string;
  contactperson: string;
  phone: string;
  website?: string;
  gstNumber?: string;
  status: "active" | "inactive";
  tags: string[];
  revenue: number;
  lastActivity: string;
  primaryContact: {
    name: string;
    phone: string;
    email?: string;
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
  churnReason?: string;
}

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Company name is required"),
  contactperson: z.string().min(1, "Contact person is required"),
  phone: z.string().min(1, "Phone number is required"),
  gstNumber: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  churnReason: z.string().optional(),
  tags: z.array(z.string()).default(["New"]),
  revenue: z.number().default(0),
  lastActivity: z.string().optional(),
  primaryContact: z.object({
    name: z.string().min(1, "Primary contact name is required"),
    phone: z.string().min(1, "Primary contact phone is required"),
    email: z.string().optional(),
    designation: z.string().optional(),
  }),
  address: z.object({
    line1: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().min(1, "Pincode is required"),
    country: z.string().default("India"),
  }),
  notes: z.string().optional(),
}).refine(data => {
  if (data.status === "inactive" && (!data.churnReason || data.churnReason.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Reason for churn is required when status is inactive",
  path: ["churnReason"]
});

type ClientFormInput = z.input<typeof clientSchema>;
type ClientFormValues = z.output<typeof clientSchema>;

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRecord;
  onSubmit: (client: ClientRecord) => void;
}

const emptyClient: ClientFormInput = {
  name: "",
  contactperson: "",
  phone: "",
  gstNumber: "",
  status: "active",
  churnReason: "",
  tags: ["New"],
  revenue: 0,
  primaryContact: { name: "", phone: "", email: "", designation: "" },
  address: { line1: "", city: "", state: "", pincode: "", country: "India" },
  notes: "",
};

export function ClientForm({ open, onOpenChange, client, onSubmit }: ClientFormProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ClientFormInput, undefined, ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyClient,
  });

  const status = watch("status");
  const gstNumber = watch("gstNumber");
  const name = watch("name");

  useEffect(() => {
    if (open) {
      reset(client ?? emptyClient);
      setGstStatus("idle");
      setGstMessage("");
    }
  }, [client, open, reset]);

  const [gstStatus, setGstStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [gstMessage, setGstMessage] = useState("");

  const verifyGST = async () => {
    const gstin = gstNumber?.trim().toUpperCase() ?? "";
    if (!isValidGSTINFormat(gstin)) {
      setGstStatus("invalid");
      setGstMessage("Invalid GSTIN format (must be 15 characters).");
      return;
    }
    setGstStatus("checking");
    try {
      const res = await fetch(`/api/gst/verify?gstin=${gstin}`);
      if (!res.ok) {
        setGstStatus("invalid");
        setGstMessage("Unable to verify GST at this time. Please check the number manually.");
        return;
      }
      const data = await res.json();
      setGstStatus("valid");
      setGstMessage(data.legalName ? `Verified: ${data.legalName}` : "Verified");
      // auto-fill company name if empty
      if (!name && data.legalName) {
        setValue("name", data.legalName, { shouldValidate: true });
      }
    } catch {
      setGstStatus("invalid");
      setGstMessage("Unable to verify GST at this time. Please check the number manually.");
    }
  };

  const save = async (data: ClientFormValues) => {
    // simulate async request
    await new Promise(resolve => setTimeout(resolve, 500));
    const clean = {
      ...data,
      id: data.id || `CL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      lastActivity: new Date().toISOString(),
    } as ClientRecord;
    onSubmit(clean);
    toast.success(client ? "Client updated" : "Client created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 max-h-[calc(100dvh-1rem)] w-full translate-y-0 rounded-b-none overflow-hidden flex flex-col sm:top-1/2 sm:bottom-auto sm:max-h-[90dvh] sm:-translate-y-1/2 sm:max-w-2xl sm:rounded-b-xl p-0 gap-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b">
          <DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>Keep company, contact, and billing details in one place.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <form id="client-form" onSubmit={handleSubmit(save)} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Company details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field id="client-name" label="Company name" error={errors.name?.message}>
                  <Input id="client-name" {...register("name")} className={errors.name ? "border-destructive" : ""} />
                </Field>
                <Field id="client-contact-person" label="Contact Person"  error={errors.contactperson?.message}>
                  <Input id="client-contact-person" {...register("contactperson")} className={errors.contactperson ? "border-destructive" : ""} />
                </Field>
               
                <Field id="client-phone" label="Phone" required error={errors.phone?.message}>
                  <Input id="client-phone" {...register("phone")} className={errors.phone ? "border-destructive" : ""} />
                </Field>
                
                <Field id="client-gst-number" label="GST number">
                  <div className="flex gap-2">
                    <Input
                      id="client-gst-number"
                      {...register("gstNumber")}
                      onChange={(e) => {
                        setValue("gstNumber", e.target.value.toUpperCase());
                        setGstStatus("idle");
                      }}
                      maxLength={15}
                      className="uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={gstStatus === "checking" || !gstNumber}
                      onClick={verifyGST}
                    >
                      {gstStatus === "checking" ? "Checking…" : "Verify"}
                    </Button>
                  </div>
                  {gstStatus === "valid" && (
                    <p className="text-xs text-success mt-1">✓ {gstMessage}</p>
                  )}
                  {gstStatus === "invalid" && (
                    <p className="text-xs text-destructive mt-1" role="alert">{gstMessage}</p>
                  )}
                </Field>
              </div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="text-sm font-semibold">Primary contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field id="primary-contact-name" label="Name"  error={errors.primaryContact?.name?.message}>
                  <Input id="primary-contact-name" {...register("primaryContact.name")} className={errors.primaryContact?.name ? "border-destructive" : ""} />
                </Field>
                <Field id="primary-contact-phone" label="Phone" required error={errors.primaryContact?.phone?.message}>
                  <Input id="primary-contact-phone" {...register("primaryContact.phone")} className={errors.primaryContact?.phone ? "border-destructive" : ""} />
                </Field>
              </div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="text-sm font-semibold">Address & Notes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field id="client-address" label="Address" required error={errors.address?.line1?.message} className="md:col-span-2">
                  <Textarea id="client-address" {...register("address.line1")} className={errors.address?.line1 ? "border-destructive" : ""} />
                </Field>
                <Field id="client-city" label="City" required error={errors.address?.city?.message}>
                  <Input id="client-city" {...register("address.city")} className={errors.address?.city ? "border-destructive" : ""} />
                </Field>
                <Field id="client-state" label="State" required error={errors.address?.state?.message}>
                  <Input id="client-state" {...register("address.state")} className={errors.address?.state ? "border-destructive" : ""} />
                </Field>
                <Field id="client-pincode" label="Pincode"  error={errors.address?.pincode?.message}>
                  <Input id="client-pincode" {...register("address.pincode")} className={errors.address?.pincode ? "border-destructive" : ""} />
                </Field>
                <Field id="client-notes" label="Notes" className="md:col-span-2">
                  <Textarea id="client-notes" {...register("notes")} />
                </Field>
              </div>
            </section>

            <section className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/20">
                <div>
                  <Label htmlFor="client-status">Active client</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Inactive clients remain available in history.</p>
                </div>
                <Switch
                  id="client-status"
                  checked={status === "active"}
                  onCheckedChange={(checked) => setValue("status", checked ? "active" : "inactive", { shouldValidate: true })}
                />
              </div>
              {status === "inactive" && (
                <Field id="client-churn-reason" label="Reason for Churn" required error={errors.churnReason?.message}>
                  <Textarea id="client-churn-reason" {...register("churnReason")} placeholder="Why is this client inactive?" className={errors.churnReason ? "border-destructive" : ""} />
                </Field>
              )}
            </section>
          </form>
        </div>
        <DialogFooter className="p-6 pt-4 shrink-0 border-t bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="client-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, required, error, className, children }: { id: string; label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 flex flex-col ${className ?? ""}`}>
      <Label htmlFor={id} className={error ? "text-destructive" : ""}>{label}{required ? " *" : ""}</Label>
      {children}
      {error && <span id={`${id}-error`} className="text-xs text-destructive" role="alert">{error}</span>}
    </div>
  );
}
