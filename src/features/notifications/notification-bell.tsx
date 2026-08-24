"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/format";
import { getNotifications, getNotificationsErrorMessage } from "./api";
import type { Notification } from "@/types/notification";

const BELL_LIMIT = 5;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  // Loaded once, on mount — this is a stateless feed (Phase 9: no read/
  // unread persistence), so there is nothing to keep in sync while the
  // popover is closed, only while the app is open.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const result = await getNotifications(BELL_LIMIT);
        if (cancelled) return;
        setNotifications(result);
        setErrorMessage("");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getNotificationsErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // A count of recent events, not an "unread" count — there is no
  // read/unread state in this phase (Phase 9 decision D2).
  const recentCount = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={recentCount > 0 ? `Notifications, ${recentCount} recent` : "Notifications"}
          className="relative rounded-full"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {hasLoaded && recentCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground ring-2 ring-background">
              {recentCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-xl overflow-hidden shadow-lg border-border/50">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Recent Activity</h3>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{errorMessage}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => {
                const body = (
                  <>
                    <p className="text-sm font-medium text-foreground">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{notif.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {formatRelativeTime(notif.timestamp)}
                    </div>
                  </>
                );
                return (
                  <Link
                    key={notif.id}
                    href={notif.href}
                    className="block p-4 space-y-1 hover:bg-muted/50 transition-colors"
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/10 text-center">
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline block py-1">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
