"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Using simple mock data directly for the bell component
const mockRecentNotifications = [
  { id: 1, title: "New Enquiry: Globex Inc", time: "5m ago", isRead: false },
  { id: 2, title: "Deal Won: Acme Corp", time: "1h ago", isRead: false },
  { id: 3, title: "Follow-up with Rahul due", time: "2h ago", isRead: true },
  { id: 4, title: "Quotation QT-2024 sent", time: "5h ago", isRead: true },
];

export function NotificationBell() {
  const [notifications, setNotifications] = useState(mockRecentNotifications);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden shadow-lg border-border/50">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:bg-transparent" onClick={markAllAsRead}>
              <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => (
                <div key={notif.id} className={`p-4 flex gap-3 hover:bg-muted/50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-primary/5' : ''}`}>
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${notif.isRead ? 'bg-transparent' : 'bg-primary shadow-[0_0_5px_rgba(var(--primary),0.5)]'}`} />
                  <div className="space-y-1 flex-1">
                    <p className={`text-sm ${notif.isRead ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                      {notif.title}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {notif.time}
                    </div>
                  </div>
                </div>
              ))}
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
