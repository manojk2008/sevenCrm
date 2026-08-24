"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { Menu, Search, Sun, Moon, Bell, User as UserIcon, LogOut, Settings } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Topbar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { open } = useCommandPaletteStore();
  const { toggleMobile, isMobileOpen } = useSidebarStore();
  const [modifierKey, setModifierKey] = React.useState("⌘");

  React.useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    queueMicrotask(() => setModifierKey(isMac ? String.fromCharCode(0x2318) : "Ctrl"));
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile Menu — opens the sidebar sheet rendered by <Sidebar /> */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={toggleMobile}
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumbs */}
      <div className="hidden min-w-0 flex-1 md:flex">
        <Breadcrumbs />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4 md:flex-none">
        {/* Search Trigger. Below sm the labelled field would push the menu
            button off-screen, so it collapses to its icon. */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 sm:hidden"
          onClick={open}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          className="relative hidden h-9 w-full max-w-[200px] justify-start rounded-lg bg-muted/50 pr-12 text-sm font-normal text-muted-foreground shadow-none sm:flex md:w-64"
          onClick={open}
        >
          <Search className="mr-2 h-4 w-4" />
          <span>Search…</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[11px] font-medium">
            <span className="text-xs">
              {modifierKey === "Ctrl" ? "Ctrl" : String.fromCharCode(0x2318)}
            </span>K
          </kbd>
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-5 w-5" />
          <span className="sr-only">
            You have {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
          </span>
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-medium leading-none text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative size-9 shrink-0 rounded-full p-0" aria-label="User menu">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : "—"}
                </div>
              </Button>
            }
          />
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name ?? "Signed in"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email ?? "—"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}