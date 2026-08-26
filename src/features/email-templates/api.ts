/**
 * Data layer for the Email Templates feature: talks to the real NestJS
 * backend (/email-templates) and maps its response onto the frontend
 * `EmailTemplate` shape (src/types/email-template.ts) — mirrors
 * src/features/tax-rates/api.ts's pattern.
 *
 * Storage/management only — there is no delivery/send function here,
 * because email delivery is not configured anywhere in the backend yet.
 */
import { apiFetch, ApiError, getFriendlyErrorMessage } from "@/lib/api";
import type { EmailTemplate, EmailTemplateKey } from "@/types/email-template";

export type BackendEmailTemplateKey = "QUOTATION_SENT" | "WELCOME" | "FOLLOW_UP_REMINDER";

// Exhaustive Record, never toLowerCase() string munging — same rule as
// every other feature's api.ts, so an unhandled backend value fails to
// compile instead of silently producing an invalid value.
const KEY_FROM_BACKEND: Record<BackendEmailTemplateKey, EmailTemplateKey> = {
  QUOTATION_SENT: "quotation-sent",
  WELCOME: "welcome",
  FOLLOW_UP_REMINDER: "follow-up-reminder",
};

export const KEY_TO_BACKEND: Record<EmailTemplateKey, BackendEmailTemplateKey> = {
  "quotation-sent": "QUOTATION_SENT",
  welcome: "WELCOME",
  "follow-up-reminder": "FOLLOW_UP_REMINDER",
};

/** Mirrors SafeEmailTemplate in backend/src/email-templates/email-templates.service.ts. */
export interface BackendEmailTemplate {
  id: string;
  organizationId: string;
  key: BackendEmailTemplateKey;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

function toEmailTemplate(template: BackendEmailTemplate): EmailTemplate {
  return {
    id: template.id,
    organizationId: template.organizationId,
    key: KEY_FROM_BACKEND[template.key],
    subject: template.subject,
    body: template.body,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/** Email-template-specific 403/404/409 wording; falls back to the shared helper otherwise. */
export function getEmailTemplateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "You don't have permission to manage email templates.";
    if (error.status === 404) return "That email template could not be found.";
    if (error.status === 409) {
      return error.message || "A template for this key already exists in your organization.";
    }
  }
  return getFriendlyErrorMessage(error);
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const result = await apiFetch<BackendEmailTemplate[]>("/email-templates");
  return result.map(toEmailTemplate);
}

export interface EmailTemplatePayload {
  key: EmailTemplateKey;
  subject: string;
  body: string;
}

export async function createEmailTemplate(payload: EmailTemplatePayload): Promise<EmailTemplate> {
  const template = await apiFetch<BackendEmailTemplate>("/email-templates", {
    method: "POST",
    body: JSON.stringify({ key: KEY_TO_BACKEND[payload.key], subject: payload.subject, body: payload.body }),
  });
  return toEmailTemplate(template);
}

export async function updateEmailTemplate(
  id: string,
  payload: Partial<Pick<EmailTemplatePayload, "subject" | "body">>,
): Promise<EmailTemplate> {
  const template = await apiFetch<BackendEmailTemplate>(`/email-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return toEmailTemplate(template);
}
