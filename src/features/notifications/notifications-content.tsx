"use client";

import { useState } from "react";
import { CheckCheck, Bell, MessageSquare, Calendar, FileText, IndianRupee, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Mock Data
const generateMockNotifications = () => {
  const types = ["enquiry", "follow-up", "quotation", "deal", "system"];
  return Array.from({ length: 50 }).map((_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const isRead = Math.random() > 0.3;
    const date = new Date();
    date.setHours(date.getHours() - (i * 2 + Math.floor(Math.random() * 5)));
    
    let title = "";
    let message = "";
    let icon = MessageSquare;
    let color = "bg-blue-100 text-blue-600";
    
    switch(type) {
      case "enquiry":
        title = "New Enquiry Received";
        message = "TechCorp Inc has submitted a new enquiry for Enterprise ERP.";
        icon = MessageSquare;
        color = "bg-blue-100 text-blue-600";
        break;
      case "follow-up":
        title = "Follow-up Reminder";
        message = "Call with Rahul Sharma scheduled in 15 minutes.";
        icon = Calendar;
        color = "bg-orange-100 text-orange-600";
        break;
      case "quotation":
        title = "Quotation Accepted";
        message = "Globex Corp has accepted the quotation #QT-2024-089.";
        icon = FileText;
        color = "bg-purple-100 text-purple-600";
        break;
      case "deal":
        title = "Deal Won!";
        message = "Congratulations! You closed the Acme Corp deal for ₹15,00,000.";
        icon = IndianRupee;
        color = "bg-green-100 text-green-600";
        break;
      case "system":
        title = "System Update";
        message = "SevenCRM has been updated to version 2.4.0.";
        icon = Settings;
        color = "bg-slate-100 text-slate-600";
        break;
    }
    
    return {
      id: `notif-${i}`,
      type,
      title,
      message,
      date,
      isRead,
      icon,
      color,
    };
  });
};

const allNotifications = generateMockNotifications();

export function NotificationsContent() {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState(allNotifications);
  
  const filteredNotifications = activeTab === "all" 
    ? notifications 
    : notifications.filter(n => n.type === activeTab.replace("-", "")); // rudimentary map
    
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  // Grouping
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const grouped = filteredNotifications.reduce((acc, notif) => {
    let group = "Earlier";
    if (notif.date.toDateString() === today.toDateString()) group = "Today";
    else if (notif.date.toDateString() === yesterday.toDateString()) group = "Yesterday";
    else if (today.getTime() - notif.date.getTime() < 7 * 24 * 60 * 60 * 1000) group = "This Week";
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(notif);
    return acc;
  }, {} as Record<string, typeof notifications>);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 pt-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-muted-foreground">Stay updated with your CRM activities</p>
          </div>
        </div>
        
        <Button variant="outline" onClick={markAllAsRead} className="rounded-xl">
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto rounded-xl bg-transparent border-b p-0 h-auto rounded-none mb-6">
          {["All", "Enquiries", "Follow-ups", "Quotations", "Deals", "System"].map(tab => {
            const value = tab.toLowerCase();
            return (
              <TabsTrigger 
                key={value} 
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                {tab}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        <div className="space-y-8 pb-10">
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No notifications found in this category.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</h3>
                <div className="bg-card border rounded-2xl overflow-hidden divide-y">
                  {items.map(notif => {
                    const Icon = notif.icon;
                    return (
                      <div 
                        key={notif.id} 
                        className={`flex gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${notif.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'font-medium'}`}>
                              {notif.title}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                              {formatDistanceToNow(notif.date, { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                        {!notif.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}
