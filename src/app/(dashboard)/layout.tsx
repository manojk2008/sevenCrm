"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrate = useAuthStore((state) => state.hydrate);
  // Zustand's auth state is in-memory only, so a fresh page load always
  // starts as unauthenticated even when a valid Better Auth session cookie
  // still exists. Check the real backend session once before deciding to
  // redirect, instead of trusting stale client state.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    hydrate().finally(() => {
      if (!cancelled) setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hydrate]);

  useEffect(() => {
    if (sessionChecked && !isAuthenticated) router.replace("/login");
  }, [sessionChecked, isAuthenticated, router]);

  if (!sessionChecked || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-thin">
          <CommandPalette />
          {children}
        </main>
      </div>
    </div>
  );
}