"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { Palette, Check, ImageOff } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { getFriendlyErrorMessage } from "@/lib/api";
import { getMyOrganization, updateMyOrganization, type BackendOrganization } from "./api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const brandingFormSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR, "Must be a hex color, e.g. #4f46e5.").optional().or(z.literal("")),
  secondaryColor: z.string().regex(HEX_COLOR, "Must be a hex color, e.g. #64748b.").optional().or(z.literal("")),
  quotationHeaderText: z.string().max(200, "Must be at most 200 characters.").optional().or(z.literal("")),
  quotationFooterText: z.string().max(2000, "Must be at most 2000 characters.").optional().or(z.literal("")),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

const DEFAULT_PRIMARY = "#4f46e5";

function toFormValues(org: BackendOrganization): BrandingFormValues {
  return {
    primaryColor: org.primaryColor ?? "",
    secondaryColor: org.secondaryColor ?? "",
    quotationHeaderText: org.quotationHeaderText ?? "",
    quotationFooterText: org.quotationFooterText ?? "",
  };
}

export function BrandingSettings() {
  const { user } = useAuthStore();
  const canEdit = user?.role === "super-admin" || user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: { primaryColor: "", secondaryColor: "", quotationHeaderText: "", quotationFooterText: "" },
  });

  // useWatch (not form.watch()) so the React Compiler can memoize this
  // component safely — must be called unconditionally, before the
  // loading/error early returns below.
  const watchedPrimaryColor = useWatch({ control: form.control, name: "primaryColor" });
  const watchedHeaderText = useWatch({ control: form.control, name: "quotationHeaderText" });
  const watchedFooterText = useWatch({ control: form.control, name: "quotationFooterText" });

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

  async function onSubmit(data: BrandingFormValues) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await updateMyOrganization({
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        quotationHeaderText: data.quotationHeaderText,
        quotationFooterText: data.quotationFooterText,
      });
      form.reset(toFormValues(updated));
      toast.success("Branding updated successfully.");
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
          <h2 className="text-xl font-semibold tracking-tight">Branding</h2>
          <p className="text-sm text-muted-foreground">
            Customize colors and quotation text for your organization.
          </p>
        </div>
        <div className="h-px w-full bg-border my-6" />
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Branding</h2>
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      </div>
    );
  }

  const fieldsDisabled = !canEdit || submitting;
  const previewColor = watchedPrimaryColor || DEFAULT_PRIMARY;
  const previewHeader = watchedHeaderText || "Quotation";
  const previewFooter = watchedFooterText || "Thank you for your business.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Branding</h2>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Customize colors and quotation text for your organization."
            : "Colors and quotation text used by your organization."}
        </p>
      </div>

      <div className="h-px w-full bg-border my-6" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-10 md:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ImageOff className="h-6 w-6" />
                </div>
                <p className="font-medium">Logo upload is not available yet.</p>
                <p className="mt-1 text-sm">This will be added in a future update.</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-12 rounded-xl border shadow-inner"
                        style={{ backgroundColor: field.value || DEFAULT_PRIMARY }}
                      />
                      <div className="relative flex-1">
                        <Palette className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder={DEFAULT_PRIMARY}
                          disabled={fieldsDisabled}
                          className="rounded-xl pl-9 font-mono"
                        />
                      </div>
                      <Input
                        type="color"
                        value={field.value || DEFAULT_PRIMARY}
                        onChange={(e) => field.onChange(e.target.value)}
                        disabled={fieldsDisabled}
                        className="h-12 w-12 cursor-pointer rounded-xl p-1"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secondaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-12 rounded-xl border shadow-inner"
                        style={{ backgroundColor: field.value || "#64748b" }}
                      />
                      <div className="relative flex-1">
                        <Palette className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="#64748b"
                          disabled={fieldsDisabled}
                          className="rounded-xl pl-9 font-mono"
                        />
                      </div>
                      <Input
                        type="color"
                        value={field.value || "#64748b"}
                        onChange={(e) => field.onChange(e.target.value)}
                        disabled={fieldsDisabled}
                        className="h-12 w-12 cursor-pointer rounded-xl p-1"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quotationHeaderText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Header Text</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Quotation" disabled={fieldsDisabled} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quotationFooterText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Footer Text</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Thank you for your business. Terms & Conditions apply."
                      disabled={fieldsDisabled}
                      className="min-h-[100px] rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {canEdit && (
              <Button type="submit" className="rounded-xl px-8" disabled={submitting}>
                {submitting ? "Saving..." : "Save Branding"}
              </Button>
            )}
          </div>

          <div>
            <Label className="mb-3 block">Preview</Label>
            <Card className="overflow-hidden rounded-xl border shadow-lg">
              <div className="h-2 w-full" style={{ backgroundColor: previewColor }} />
              <CardContent className="space-y-6 p-6">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-32 animate-pulse rounded bg-muted" />
                  <div className="text-right">
                    <h3 className="text-lg font-bold uppercase">{previewHeader}</h3>
                    <p className="text-sm text-muted-foreground">#QT-2026-001</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>

                <p className="border-t pt-4 text-xs text-muted-foreground">{previewFooter}</p>

                <div className="flex justify-end border-t pt-6">
                  <div
                    className="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium text-white"
                    style={{ backgroundColor: previewColor }}
                  >
                    <Check className="h-4 w-4" /> Accept Quotation
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
