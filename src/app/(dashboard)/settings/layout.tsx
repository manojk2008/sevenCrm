"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Palette, Receipt, Shield, Mail, Webhook, HardDrive, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarNavItems = [
  {
    title: "General",
    items: [
      { title: "Company Profile", href: "/settings/company", icon: Building2 },
      { title: "Branding", href: "/settings/branding", icon: Palette },
    ]
  },
  {
    title: "Business",
    items: [
      { title: "Tax Rates", href: "/settings/taxes", icon: Receipt },
      { title: "Email Templates", href: "/settings/email-templates", icon: Mail },
    ]
  },
  {
    title: "Team & Security",
    items: [
      { title: "Roles & Permissions", href: "/settings/roles", icon: Shield },
      { title: "Audit Logs", href: "/settings/audit-logs", icon: ScrollText },
    ]
  },
  {
    title: "System",
    items: [
      { title: "Integrations", href: "/settings/integrations", icon: Webhook },
      { title: "Backup & Restore", href: "/settings/backup", icon: HardDrive },
    ]
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <aside className="w-full shrink-0 space-y-6 md:w-64">
        <div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your application preferences</p>
        </div>
        
        <nav className="space-y-6">
          {sidebarNavItems.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                {section.title}
              </h4>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      {/* A plain div, not <main> — the dashboard shell already owns the
          main landmark, and nesting a second one breaks landmark navigation. */}
      <div className="min-w-0 flex-1">
        <div className="min-h-[600px] rounded-xl border bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
