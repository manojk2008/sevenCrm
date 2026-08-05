"use client";

import { useSidebarStore } from "@/stores/sidebar-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Building2,
  Package,
  TrendingUp,
  CalendarClock,
  FileText,
  IndianRupee,
  BarChart3,
  LineChart,
  Users,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "MAIN",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "CRM",
    items: [
      { label: "Clients", href: "/clients", icon: Building2 },
      { label: "Products", href: "/products", icon: Package },
      { label: "Enquiries", href: "/enquiries", icon: TrendingUp },
      { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock, badge: "3" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Sales", href: "/sales", icon: IndianRupee },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Analytics", href: "/analytics", icon: LineChart },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Users", href: "/users", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();
  const { user } = useAuthStore();
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 280 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-40 flex h-full flex-col border-r bg-sidebar text-sidebar-foreground"
      >
        {/* Header / Logo */}
        <div className="flex h-16 shrink-0 items-center justify-center border-b px-4">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="full-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex w-full items-center gap-2 font-bold text-xl text-primary"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  S7
                </div>
                <span>SevenCRM</span>
              </motion.div>
            ) : (
              <motion.div
                key="mini-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
              >
                S7
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-4">
          <nav className="flex flex-col gap-6 px-3">
            {NAV_SECTIONS.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                {!isCollapsed && (
                  <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                    {section.title}
                  </h4>
                )}
                {section.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;

                  const navItem = (
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      {!isCollapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );

                  return isCollapsed ? (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-2">
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto text-muted-foreground">({item.badge})</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={item.label}>{navItem}</div>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* User / Footer */}
        <div className="mt-auto border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "JD"}
            </div>
            {!isCollapsed && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium leading-none">
                  {user?.name || "John Doe"}
                </span>
                <span className="truncate text-xs text-muted-foreground mt-1">
                  {user?.role || "Administrator"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggle}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground z-50 transition-transform"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}
