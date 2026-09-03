"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Building,
  CalendarClock,
  Car,
  CheckCircle2,
  FileText,
  Mail,
  MonitorPlay,
  PhoneCall,
  User,
  Users,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowUpHistory } from "./follow-up-history";
import type { FollowUp, FollowUpType } from "@/types/follow-up";

const TYPE_ICONS: Record<FollowUpType, React.ComponentType<{ className?: string }>> = {
  call: PhoneCall,
  email: Mail,
  meeting: Users,
  demo: MonitorPlay,
  visit: Car,
};

const TYPE_LABELS: Record<FollowUpType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  demo: "Demo",
  visit: "Visit",
};

interface FollowUpDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUp | null;
  onEdit?: (followUp: FollowUp) => void;
  onComplete?: (followUp: FollowUp) => void;
  onCancel?: (followUp: FollowUp) => void;
  /**
   * Permanently deletes the follow-up; the parent owns the confirmation
   * dialog. Omitted to hide the button entirely — used for the
   * SUPER_ADMIN/ADMIN-only UX gate, same pattern as ProductsContent's
   * canManage.
   */
  onDelete?: (followUp: FollowUp) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Renders a value, or a muted em dash when the backend genuinely has none. */
function Value({ children }: { children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <>{children}</>;
}

export function FollowUpDetail({
  open,
  onOpenChange,
  followUp,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
}: FollowUpDetailProps) {
  if (!followUp) return null;

  const TypeIcon = TYPE_ICONS[followUp.type];
  const scheduled = new Date(followUp.scheduledAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden border-l p-0 sm:max-w-xl">
        <div className="flex-shrink-0 border-b bg-card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {followUp.status}
            </Badge>
            <Badge variant="secondary" className="uppercase text-[11px]">
              {followUp.priority} priority
            </Badge>
            {/* Derived from the backend's isOverdue, never a stored status. */}
            {followUp.isOverdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </Badge>
            )}
            {followUp.reminder && (
              <Badge variant="outline" className="gap-1">
                <Bell className="h-3 w-3" /> Reminder flagged
              </Badge>
            )}
          </div>

          <SheetTitle className="text-xl font-bold md:text-2xl">{followUp.subject}</SheetTitle>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            {followUp.client.companyName}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(followUp)}>
                Edit
              </Button>
            )}
            {followUp.status === "scheduled" && onComplete && (
              <Button size="sm" onClick={() => onComplete(followUp)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark complete
              </Button>
            )}
            {followUp.status === "scheduled" && onCancel && (
              <Button variant="outline" size="sm" onClick={() => onCancel(followUp)}>
                Cancel follow-up
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(followUp)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <span className="flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                {TYPE_LABELS[followUp.type]}
              </span>
            </Field>
            <Field label="Priority">
              <span className="capitalize">{followUp.priority}</span>
            </Field>

            <Field label="Scheduled">
              <span className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {format(scheduled, "dd MMM yyyy, h:mm a")}
              </span>
            </Field>
            <Field label="Status">
              <span className="capitalize">{followUp.status}</span>
            </Field>

            <Field label="Client">
              <Value>{followUp.client.companyName}</Value>
            </Field>
            <Field label="Enquiry">
              {/* The real linked Enquiry, resolved by the backend — never a
                  fabricated reference number. Navigable: opens the Enquiry's
                  own detail dialog on the Enquiries page (see the
                  `?enquiryId=` handling in enquiries-content.tsx), same
                  precedent as the Dashboard's `?stage=` links. */}
              <Value>
                {followUp.enquiry ? (
                  <Link
                    href={`/enquiries?enquiryId=${followUp.enquiry.id}`}
                    className="flex items-center gap-2 text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <FileText className="h-4 w-4" />
                    {followUp.enquiry.title}
                  </Link>
                ) : null}
              </Value>
            </Field>

            <Field label="Assigned to">
              <Value>
                {followUp.assignedTo ? (
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {followUp.assignedTo.name}
                  </span>
                ) : null}
              </Value>
            </Field>
            <Field label="Completed at">
              <Value>
                {followUp.completedAt
                  ? format(new Date(followUp.completedAt), "dd MMM yyyy, h:mm a")
                  : null}
              </Value>
            </Field>
          </div>

          <Field label="Description">
            <p className="whitespace-pre-wrap">
              <Value>{followUp.description}</Value>
            </p>
          </Field>

          <Field label="Notes">
            <p className="whitespace-pre-wrap">
              <Value>{followUp.notes}</Value>
            </p>
          </Field>

          <Field label="Outcome">
            <p className="whitespace-pre-wrap">
              <Value>{followUp.outcome}</Value>
            </p>
          </Field>

          {/* What happened before (and after) this Follow-up for the same
              Enquiry — omitted entirely for a Follow-up with no linked
              Enquiry, same as the field above. */}
          {followUp.enquiry && (
            <Field label="Follow-up history for this Enquiry">
              <FollowUpHistory enquiryId={followUp.enquiry.id} currentFollowUpId={followUp.id} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs text-muted-foreground">
            <div>Created {format(new Date(followUp.createdAt), "dd MMM yyyy, h:mm a")}</div>
            <div>Updated {format(new Date(followUp.updatedAt), "dd MMM yyyy, h:mm a")}</div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
