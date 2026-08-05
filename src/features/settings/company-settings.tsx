"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { Building2, Mail, Phone, Globe, MapPin, Hash, Briefcase } from "lucide-react";

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

const companyFormSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(10, "Phone number must be at least 10 digits."),
  website: z.string().url("Must be a valid URL.").optional().or(z.literal("")),
  address: z.string().min(10, "Please provide a complete address."),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST Number format").optional().or(z.literal("")),
  industry: z.string().min(2, "Industry is required."),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

const defaultValues: Partial<CompanyFormValues> = {
  companyName: "SevenCRM Solutions",
  email: "contact@sevencrm.in",
  phone: "+91 9876543210",
  website: "https://sevencrm.in",
  address: "123 Business Park, Sector 4, Tech City\nBangalore, Karnataka 560001",
  gstNumber: "29ABCDE1234F1Z5",
  industry: "Software & Technology",
};

export function CompanySettings() {
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues,
  });

  function onSubmit(data: CompanyFormValues) {
    toast.success("Company profile updated successfully.");
    console.log(data);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">Company Profile</h3>
        <p className="text-sm text-muted-foreground">
          Update your company details and legal information.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" {...field} />
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
                  <FormLabel>Support Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="email" className="pl-9 rounded-xl" {...field} />
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
                  <FormLabel>Business Phone *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website URL</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 rounded-xl" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registered Address *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea className="pl-9 min-h-[100px] rounded-xl" {...field} />
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
                    <Input className="pl-9 rounded-xl uppercase" placeholder="29XXXXX0000X0X0" {...field} />
                  </div>
                </FormControl>
                <FormDescription>
                  Required for tax calculations in India.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="rounded-xl px-8">Save Changes</Button>
        </form>
      </Form>
    </div>
  );
}
