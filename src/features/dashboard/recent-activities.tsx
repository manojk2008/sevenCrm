"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, UserPlus, FileText, PhoneCall, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { getRecentActivity, getDashboardErrorMessage } from "./api";
import type { Activity } from "@/types/dashboard";

const ACTIVITY_META: Record<
  Activity["type"],
  { icon: LucideIcon; color: string; title: string }
> = {
  "client-created": {
    icon: Building2,
    color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
    title: "New Client",
  },
  "enquiry-created": {
    icon: UserPlus,
    color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30",
    title: "New Enquiry",
  },
  "quotation-created": {
    icon: FileText,
    color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
    title: "Quotation Raised",
  },
  "follow-up-completed": {
    icon: PhoneCall,
    color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
    title: "Follow-up Completed",
  },
};

function describe(activity: Activity): string {
  switch (activity.type) {
    case "client-created":
      return `${activity.companyName} was added as a client.`;
    case "enquiry-created":
      return `${activity.title} — ${activity.clientName}`;
    case "quotation-created":
      return `${activity.quotationNumber} raised for ${activity.clientName}`;
    case "follow-up-completed":
      return `${activity.subject} — ${activity.clientName}`;
  }
}

export function RecentActivities() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const result = await getRecentActivity(15);
        if (cancelled) return;
        setActivities(result.activities);
        setErrorMessage("");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getDashboardErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
          <CardDescription>Latest client, enquiry, quotation and follow-up events</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden relative p-0">
          {isLoading ? (
            <div className="space-y-3 px-6 pb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : errorMessage ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{errorMessage}</p>
          ) : !activities || activities.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <div className="absolute inset-0 overflow-y-auto px-6 pb-6 custom-scrollbar">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                {activities.map((act) => {
                  const meta = ACTIVITY_META[act.type];
                  return (
                    <div
                      key={act.id}
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10",
                          meta.color,
                        )}
                      >
                        <meta.icon className="w-4 h-4" />
                      </div>

                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border border-border bg-muted/40 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-sm">{meta.title}</h4>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {formatRelativeTime(act.occurredAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {describe(act)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
