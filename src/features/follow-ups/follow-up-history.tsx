"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Mail,
  MonitorPlay,
  PhoneCall,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listFollowUps, getFollowUpErrorMessage } from "./api";
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

interface FollowUpHistoryProps {
  enquiryId: string;
  /** Visually marked as "this one" — never excluded from the list. */
  currentFollowUpId?: string;
  emptyMessage?: string;
}

/**
 * Chronological Follow-up history for one Enquiry — reused by both the
 * Enquiry detail's "Follow-up History" tab and the Follow-up detail sheet
 * ("previous Follow-up history for this Enquiry"), so the two never drift
 * apart. Entirely read-only: recording an outcome/rescheduling/completing
 * still happens exclusively on the Follow-ups page, never duplicated here.
 *
 * Every field shown (status, type, scheduledAt, outcome, notes) is existing
 * FollowUp data via the existing listFollowUps({ enquiryId }) call — nothing
 * new is stored or fabricated.
 *
 * Only the automatic sequence gets a numbered "Follow-up N" label — the
 * ordinal position among isAutoManaged rows only (never Enquiry.stage, and
 * never subject text), so it's always an honest account of what actually
 * happened even if the Enquiry's pipeline stage was never manually moved in
 * lockstep (see src/features/enquiries/follow-up-sync.ts). A manually
 * created Follow-up tied to the same Enquiry still appears in history (never
 * hidden) — shown by its own subject instead, since it isn't part of the
 * numbered sequence.
 */
export function FollowUpHistory({
  enquiryId,
  currentFollowUpId,
  emptyMessage = "No follow-up history yet.",
}: FollowUpHistoryProps) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  // Deferred via .then() rather than calling setState directly in the effect
  // body — same react-hooks/set-state-in-effect reasoning as loadEnquiries in
  // enquiries-content.tsx.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setState("loading");
      listFollowUps({ enquiryId, pageSize: 100 })
        .then((result) => {
          if (cancelled) return;
          // Oldest first — a history reads chronologically, not by page order.
          const sorted = [...result.data].sort(
            (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
          );
          setFollowUps(sorted);
          setState("ready");
        })
        .catch((error) => {
          if (cancelled) return;
          setErrorMessage(getFollowUpErrorMessage(error));
          setState("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [enquiryId]);

  if (state === "loading") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return <p className="text-sm text-destructive">{errorMessage}</p>;
  }

  if (followUps.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  // Built with a plain for loop rather than followUps.map(...) — the React
  // Compiler flags mutating a variable from inside any function passed to
  // another function (including .map()'s callback) as a possible reuse-
  // across-renders hazard. A for loop over a fresh array has no such
  // callback for it to be suspicious of.
  const rows: { followUp: FollowUp; label: string }[] = [];
  let autoIndex = 0;
  for (const followUp of followUps) {
    if (followUp.isAutoManaged) autoIndex += 1;
    const label =
      followUp.isAutoManaged && autoIndex <= 3 ? `Follow-up ${autoIndex}` : followUp.subject;
    rows.push({ followUp, label });
  }

  return (
    <ol className="space-y-3">
      {rows.map(({ followUp, label }) => {
        const TypeIcon = TYPE_ICONS[followUp.type];
        const isCurrent = followUp.id === currentFollowUpId;

        return (
          <li
            key={followUp.id}
            className={`flex gap-3 rounded-lg border p-3 ${
              isCurrent ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20" : ""
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {followUp.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : followUp.status === "cancelled" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Clock className="h-4 w-4 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <Badge variant="outline" className="capitalize">
                  {followUp.status}
                </Badge>
                {followUp.isOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </Badge>
                )}
                {isCurrent && <span className="text-xs text-indigo-600 dark:text-indigo-400">This one</span>}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TypeIcon className="h-3.5 w-3.5" />
                {TYPE_LABELS[followUp.type]} · {format(new Date(followUp.scheduledAt), "MMM d, yyyy")}
              </p>
              {followUp.outcome && (
                <p className="text-sm">
                  <span className="font-medium">Outcome: </span>
                  {followUp.outcome}
                </p>
              )}
              {followUp.notes && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Notes: </span>
                  {followUp.notes}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
