"use client";

import { MessageCircle, Mail, Calendar, Check, ExternalLink } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function IntegrationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Connect SevenCRM with your favorite tools and services.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border/50 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Coming Soon</Badge>
          </div>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 mb-4">
              <MessageCircle className="h-6 w-6" />
            </div>
            <CardTitle>WhatsApp Business</CardTitle>
            <CardDescription className="h-10">
              Send automated messages and quotations directly to clients via WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full rounded-xl" variant="outline">
              Configure
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 p-4">
            <Badge className="bg-green-500 hover:bg-green-600 flex gap-1 items-center">
              <Check className="h-3 w-3" /> Active
            </Badge>
          </div>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle>Email (SMTP)</CardTitle>
            <CardDescription className="h-10">
              Connect your company email to send communications directly from the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full rounded-xl" variant="outline">
              Configure Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <Badge variant="outline" className="text-muted-foreground">Disconnected</Badge>
          </div>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-4">
              <Calendar className="h-6 w-6" />
            </div>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription className="h-10">
              Sync follow-ups and meetings directly with your Google Calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full rounded-xl bg-primary/10 text-primary hover:bg-primary/20">
              Connect Account <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
