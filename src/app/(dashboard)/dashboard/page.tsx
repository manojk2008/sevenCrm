import { DashboardContent } from "@/features/dashboard/dashboard-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | SevenCRM",
};

export default function DashboardPage() {
  return <DashboardContent />;
}
