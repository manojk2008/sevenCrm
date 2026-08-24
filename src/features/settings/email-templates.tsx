"use client";

import { useState } from "react";
import { Edit2, Save, FileText, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialTemplates = [
  { id: "quote", name: "Quotation Email", subject: "Quotation {{quotation_number}} from SevenCRM", body: "Dear {{client_name}},\n\nPlease find attached the quotation {{quotation_number}} for your reference.\n\nTotal Amount: {{total_amount}}\n\nLet us know if you have any questions.\n\nBest regards,\n{{sender_name}}" },
  { id: "welcome", name: "Welcome Email", subject: "Welcome to SevenCRM", body: "Hi {{client_name}},\n\nWelcome aboard! We are thrilled to have you." },
  { id: "followup", name: "Follow-up Reminder", subject: "Following up on our conversation", body: "Hi {{client_name}},\n\nJust wanted to follow up regarding..." },
];

export function EmailTemplates() {
  const [activeTemplateId, setActiveTemplateId] = useState("quote");
  const activeTemplate = initialTemplates.find(t => t.id === activeTemplateId) || initialTemplates[0];

  const handleSave = () => {
    toast.success("Email template saved successfully.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Email Templates</h2>
        <p className="text-sm text-muted-foreground">
          Customize the emails sent from your CRM.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Available Templates</Label>
          <div className="space-y-2">
            {initialTemplates.map(t => (
              <div 
                key={t.id}
                onClick={() => setActiveTemplateId(t.id)}
                className={`p-4 rounded-xl cursor-pointer transition-colors border ${activeTemplateId === t.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'}`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`h-5 w-5 ${activeTemplateId === t.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-sm font-medium ${activeTemplateId === t.id ? 'text-primary' : 'text-foreground'}`}>{t.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <Card className="rounded-xl shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-xl">{activeTemplate.name}</CardTitle>
                <CardDescription>Edit template content</CardDescription>
              </div>
              <Button size="sm" onClick={handleSave} className="rounded-xl">
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input defaultValue={activeTemplate.subject} className="rounded-xl font-medium" />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea 
                  defaultValue={activeTemplate.body} 
                  className="min-h-[250px] rounded-xl font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {['{{client_name}}', '{{company_name}}', '{{quotation_number}}', '{{total_amount}}', '{{sender_name}}'].map(variable => (
                    <span key={variable} className="px-2 py-1 bg-muted rounded-md text-xs font-mono cursor-pointer hover:bg-muted-foreground/20 transition-colors">
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
