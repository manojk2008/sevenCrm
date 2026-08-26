"use client";

/**
 * Email Templates — real, organization-scoped storage/management backed by
 * GET/POST/PATCH /email-templates (see backend/src/email-templates).
 * Replaces the old hardcoded initialTemplates array entirely. Storage only:
 * there is no email delivery/SMTP configured anywhere in the backend yet,
 * so this page says so explicitly rather than implying templates are sent.
 * SALES_EXECUTIVE has no access at all — the backend rejects every route
 * for that role, and this page never attempts to load data for it.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Save, ShieldAlert } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/shared/skeleton-loader";
import { ErrorState } from "@/components/shared/error-state";
import {
  createEmailTemplate,
  getEmailTemplateErrorMessage,
  listEmailTemplates,
  updateEmailTemplate,
} from "@/features/email-templates/api";
import { EMAIL_TEMPLATE_KEYS, type EmailTemplate, type EmailTemplateKey } from "@/types/email-template";

type LoadState = "loading" | "error" | "ready";

const VARIABLES = ["{{client_name}}", "{{company_name}}", "{{quotation_number}}", "{{total_amount}}", "{{sender_name}}"];

interface DraftState {
  subject: string;
  body: string;
}

export function EmailTemplates() {
  const role = useAuthStore((state) => state.user?.role);
  const hasAccess = role === "super-admin" || role === "admin";

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const [activeKey, setActiveKey] = useState<EmailTemplateKey>(EMAIL_TEMPLATE_KEYS[0].value);
  const [draft, setDraft] = useState<DraftState>({ subject: "", body: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!hasAccess) return;
    setLoadState("loading");
    try {
      const result = await listEmailTemplates();
      setTemplates(result);
      setLoadState("ready");
    } catch (error) {
      setLoadErrorMessage(getEmailTemplateErrorMessage(error));
      setLoadState("error");
    }
  }, [hasAccess]);

  useEffect(() => {
    Promise.resolve().then(loadTemplates);
  }, [loadTemplates]);

  const activeTemplate = templates.find((t) => t.key === activeKey) ?? null;

  // Keeps the editor in sync when switching slots or after a reload —
  // deliberately re-syncs from `activeTemplate` rather than being
  // uncontrolled, so a save is never lost silently and an unsaved edit
  // never bleeds into a different template slot. Deferred to a microtask so
  // the setState doesn't run synchronously within the effect body (matches
  // the pattern used by src/features/notifications/notifications-content.tsx
  // for the same lint rule).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setDraft({ subject: activeTemplate?.subject ?? "", body: activeTemplate?.body ?? "" });
      setSaveError("");
    });
    return () => {
      cancelled = true;
    };
  }, [activeTemplate, activeKey]);

  const handleSave = async () => {
    if (!draft.subject.trim() || !draft.body.trim()) return;
    setIsSaving(true);
    setSaveError("");
    try {
      if (activeTemplate) {
        await updateEmailTemplate(activeTemplate.id, { subject: draft.subject, body: draft.body });
      } else {
        await createEmailTemplate({ key: activeKey, subject: draft.subject, body: draft.body });
      }
      toast.success("Email template saved.");
      await loadTemplates();
    } catch (error) {
      setSaveError(getEmailTemplateErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Email Templates</h2>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <ShieldAlert className="mb-4 h-10 w-10 opacity-50" />
          <p className="font-medium text-foreground">You don&apos;t have permission to view this page.</p>
          <p className="mt-1 text-sm">Only a Super Admin or Admin can manage email templates.</p>
        </div>
      </div>
    );
  }

  const activeMeta = EMAIL_TEMPLATE_KEYS.find((k) => k.value === activeKey)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Email Templates</h2>
        <p className="text-sm text-muted-foreground">Compose the content used for each type of email.</p>
      </div>

      <Alert>
        <AlertDescription>
          Templates are stored for future email delivery. Email sending is not configured yet — saving a
          template here does not send anything.
        </AlertDescription>
      </Alert>

      <div className="h-px w-full bg-border my-6" />

      {loadState === "loading" && <TableSkeleton rows={3} />}

      {loadState === "error" && (
        <ErrorState title="Couldn't load email templates" description={loadErrorMessage} onRetry={loadTemplates} />
      )}

      {loadState === "ready" && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Templates</Label>
            <div className="space-y-2">
              {EMAIL_TEMPLATE_KEYS.map((k) => {
                const exists = templates.some((t) => t.key === k.value);
                const isActive = activeKey === k.value;
                return (
                  <div
                    key={k.value}
                    onClick={() => setActiveKey(k.value)}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>{k.label}</p>
                        <p className="text-xs text-muted-foreground">{exists ? "Configured" : "Not set up yet"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle className="text-xl">{activeMeta.label}</CardTitle>
                  <CardDescription>{activeMeta.description}</CardDescription>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={handleSave}
                  disabled={isSaving || !draft.subject.trim() || !draft.body.trim()}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {activeTemplate ? "Save" : "Create"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label>Email Subject</Label>
                  <Input
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    className="rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Body</Label>
                  <Textarea
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="min-h-[250px] rounded-xl font-mono text-sm"
                  />
                </div>
                {saveError && (
                  <p className="text-sm text-destructive" role="alert">
                    {saveError}
                  </p>
                )}
                <div>
                  <Label className="mb-2 block text-xs text-muted-foreground">Available Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((variable) => (
                      <button
                        type="button"
                        key={variable}
                        onClick={() => setDraft({ ...draft, body: `${draft.body}${variable}` })}
                        className="rounded-md bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted-foreground/20"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
