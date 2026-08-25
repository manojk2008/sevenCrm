"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { Building2, Mail, Phone, Globe, MapPin, Hash } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { getFriendlyErrorMessage } from "@/lib/api";
import { getMyOrganization, updateMyOrganization, type BackendOrganization } from "./api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const companyFormSchema = z.object({
  name: z
    .string()
    .min(1, "Company name is required.")
    .max(200, "Company name must be at most 200 characters."),
  email: z.string().email("Invalid email address.").max(300).optional().or(z.literal("")),
  phone: z.string().max(50, "Phone number is too long.").optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL.").max(300).optional().or(z.literal("")),
  address: z.string().max(500, "Address is too long.").optional().or(z.literal("")),
  gstNumber: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST Number format")
    .optional()
    .or(z.literal("")),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

function toFormValues(org: BackendOrganization): CompanyFormValues {
  return {
    name: org.name,
    email: org.email ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
    address: org.address ?? "",
    gstNumber: org.gstNumber ?? "",
  };
}

export function CompanySettings() {
  const { user } = useAuthStore();
  const canEdit = user?.role === "super-admin" || user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { name: "", email: "", phone: "", website: "", address: "", gstNumber: "" },
  });

  useEffect(() => {
    let cancelled = false;
    getMyOrganization()
      .then((org) => {
        if (cancelled) return;
        form.reset(toFormValues(org));
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getFriendlyErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: CompanyFormValues) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await updateMyOrganization({
        name: data.name,
        address: data.address,
        phone: data.phone,
        // Empty string fails backend @IsEmail validation, and this DTO has
        // no way to explicitly clear email to null — so an emptied field
        // is simply left unchanged rather than sent and rejected.
        ...(data.email ? { email: data.email } : {}),
        website: data.website,
        gstNumber: data.gstNumber,
      });
      form.reset(toFormValues(updated));
      toast.success("Company profile updated successfully.");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Company Profile</h2>
          <p className="text-sm text-muted-foreground">
            Update your company details and legal information.
          </p>
        </div>
        <div className="h-px bg-border w-full my-6" />
        <div className="space-y-6 max-w-2xl">
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Company Profile</h2>
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      </div>
    );
  }

  const fieldsDisabled = !canEdit || submitting;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Company Profile</h2>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Update your company details and legal information."
            : "View your company details and legal information."}
        </p>
      </div>

      <div className="h-px bg-border w-full my-6" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" disabled={fieldsDisabled} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="email" className="pl-9 rounded-xl" disabled={fieldsDisabled} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Phone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" disabled={fieldsDisabled} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" disabled={fieldsDisabled} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registered Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      className="pl-9 min-h-[100px] rounded-xl"
                      disabled={fieldsDisabled}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  This address will appear on your quotations and invoices.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gstNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 rounded-xl uppercase"
                      placeholder="29XXXXX0000X0X0"
                      disabled={fieldsDisabled}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormDescription>Required for tax calculations in India.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {canEdit && (
            <Button type="submit" className="rounded-xl px-8" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
}
