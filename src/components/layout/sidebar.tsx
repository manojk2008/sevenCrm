"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

type NavSection = {
  title: string | null;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    // A single destination doesn't need a group heading above it.
    title: null,
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
    title: "INSIGHTS",
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

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {!collapsed ? (
        <motion.div
          key="full-logo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex w-full items-center gap-2 text-xl font-bold text-primary"
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
  );
}

/**
 * The nav body. Shared verbatim between the desktop rail and the mobile
 * sheet so the two can never drift apart.
 */
function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3">
      {NAV_SECTIONS.map((section, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          {!collapsed && section.title && (
            <h4 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h4>
          )}
          {section.items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            const navItem = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={item.label}>
                <TooltipTrigger render={navItem} />
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
  );
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuthStore();
  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : "—";

  return (
    <div className="mt-auto border-t p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium leading-none">
              {user?.name ?? "Signed in"}
            </span>
            <span className="mt-1 truncate text-xs text-muted-foreground">
              {user?.role ?? "—"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, closeMobile } = useSidebarStore();
  const pathname = usePathname();

  // Navigating from inside the sheet should dismiss it.
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <>
      {/* Desktop rail. Hidden below md — the sheet below takes over there. */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 280 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-40 hidden h-full flex-col border-r bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex h-16 shrink-0 items-center justify-center border-b px-4">
          <Brand collapsed={isCollapsed} />
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden py-4">
          <SidebarNav collapsed={isCollapsed} />
        </div>

        <SidebarUser collapsed={isCollapsed} />

        <button
          onClick={toggle}
          // Sits at the vertical middle of the rail edge; at top-20 it landed
          // directly on the first nav row.
          className="absolute -right-4 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </motion.aside>

      {/* Mobile: the same nav in a dismissible sheet. */}
      <Sheet open={isMobileOpen} onOpenChange={(open) => !open && closeMobile()}>
        <SheetContent
          side="left"
          showCloseButton={false}
          // The primitive's `data-[side=left]:w-3/4` outranks a plain width
          // utility, so match its specificity to pin the drawer at 280px.
          className="bg-sidebar p-0 text-sidebar-foreground data-[side=left]:w-[280px] data-[side=left]:max-w-[85vw] md:hidden"
        >
          <div className="flex h-16 shrink-0 items-center border-b px-4">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand collapsed={false} />
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden py-4">
            <SidebarNav collapsed={false} onNavigate={closeMobile} />
          </div>

          <SidebarUser collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
