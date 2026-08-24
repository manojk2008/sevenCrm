"use client";

/**
 * Notifications — a real, stateless feed derived entirely from real CRM
 * timestamps (see backend/src/notifications, which reuses Dashboard's
 * Recent Activity). Phase 9 is explicitly stateless: there is no read/
 * unread state anywhere, so this page never claims one — no "mark as
 * read," no unread badge, no per-item read styling.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Building2, FileText, PhoneCall, UserPlus, type LucideIcon } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNotifications, getNotificationsErrorMessage } from "./api";
import type { Notification, NotificationType } from "@/types/notification";

const PAGE_LIMIT = 50;

const TYPE_META: Record<NotificationType, { icon: LucideIcon; color: string }> = {
  "client-created": {
    icon: Building2,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "enquiry-created": {
    icon: UserPlus,
    color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  "quotation-created": {
    icon: FileText,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  "follow-up-completed": {
    icon: PhoneCall,
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

const TABS: { value: string; label: string; types: NotificationType[] | null }[] = [
  { value: "all", label: "All", types: null },
  { value: "clients", label: "Clients", types: ["client-created"] },
  { value: "enquiries", label: "Enquiries", types: ["enquiry-created"] },
  { value: "quotations", label: "Quotations", types: ["quotation-created"] },
  { value: "follow-ups", label: "Follow-ups", types: ["follow-up-completed"] },
];

function groupByRecency(notifications: Notification[]): Record<string, Notification[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return notifications.reduce<Record<string, Notification[]>>((acc, notif) => {
    const date = new Date(notif.timestamp);
    let group = "Earlier";
    if (date.toDateString() === today.toDateString()) group = "Today";
    else if (date.toDateString() === yesterday.toDateString()) group = "Yesterday";
    else if (today.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) group = "This Week";

    (acc[group] ??= []).push(notif);
    return acc;
  }, {});
}

export function NotificationsContent() {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    setLoadState("loading");
    try {
      const result = await getNotifications(PAGE_LIMIT);
      setNotifications(result);
      setErrorMessage("");
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(getNotificationsErrorMessage(error));
      setLoadState("error");
    }
  };

  useEffect(() => {
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously within the effect body (matches the pattern used by
    // src/features/sales/sales-content.tsx for the same lint rule).
    Promise.resolve().then(load);
  }, []);

  const activeTypes = TABS.find((t) => t.value === activeTab)?.types ?? null;
  const filtered = activeTypes
    ? notifications.filter((n) => activeTypes.includes(n.type))
    : notifications;
  const grouped = groupByRecency(filtered);
  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-3 rounded-xl text-primary">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Recent client, enquiry, quotation, and follow-up activity</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto rounded-xl bg-transparent border-b p-0 h-auto rounded-none mb-6">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="space-y-8 pb-10">
          {loadState === "loading" && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          )}

          {loadState === "error" && (
            <div className="text-center py-12 space-y-3">
              <Bell className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <button
                onClick={() => void load()}
                className="text-sm font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {loadState === "ready" && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No notifications in this category.</p>
            </div>
          )}

          {loadState === "ready" &&
            filtered.length > 0 &&
            groupOrder
              .filter((group) => grouped[group]?.length)
              .map((groupName) => (
                <div key={groupName} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {groupName}
                  </h3>
                  <div className="bg-card border rounded-xl overflow-hidden divide-y">
                    {grouped[groupName].map((notif) => {
                      const meta = TYPE_META[notif.type];
                      return (
                        <Link
                          key={notif.id}
                          href={notif.href}
                          className="flex gap-4 p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                            <meta.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-medium">{notif.title}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                {formatRelativeTime(notif.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notif.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
        </div>
      </Tabs>
    </div>
  );
}
