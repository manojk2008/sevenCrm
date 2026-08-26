/**
 * Mirrors SafeEmailTemplate in backend/src/email-templates/email-templates.service.ts,
 * translated to this codebase's lower-case-hyphenated key convention by
 * src/features/email-templates/api.ts.
 *
 * `key` is a closed set matching the real Prisma `EmailTemplateKey` enum —
 * see backend/prisma/schema.prisma. There is deliberately no "sent" status,
 * provider status, or delivery state anywhere on this type: storage and
 * delivery are separate concerns, and delivery is not implemented yet.
 */
export type EmailTemplateKey = "quotation-sent" | "welcome" | "follow-up-reminder";

export const EMAIL_TEMPLATE_KEYS: { value: EmailTemplateKey; label: string; description: string }[] = [
  {
    value: "quotation-sent",
    label: "Quotation Sent",
    description: "Sent to a client along with a new quotation.",
  },
  {
    value: "welcome",
    label: "Welcome Email",
    description: "Sent to a new client when they're added.",
  },
  {
    value: "follow-up-reminder",
    label: "Follow-up Reminder",
    description: "Sent as a reminder for a scheduled follow-up.",
  },
];

export interface EmailTemplate {
  id: string;
  organizationId: string;
  key: EmailTemplateKey;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
