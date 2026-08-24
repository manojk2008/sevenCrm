"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  IndianRupee,
  Users,
  ArrowRightLeft,
  Calendar,
  Package,
  Kanban,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_REPORT_TYPES, type ReportType } from "@/types/reports";

const reports = [
  {
    id: "client",
    title: "Client Report",
    description: "Client acquisition and distribution analysis",
    icon: Building2,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "sales",
    title: "Sales Report",
    description: "Sales performance and deal analytics",
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-600",
  },
  {
    id: "revenue",
    title: "Revenue Report",
    description: "Revenue breakdown and trends",
    icon: IndianRupee,
    color: "bg-indigo-500/10 text-indigo-600",
  },
  {
    id: "executive",
    title: "Executive Report",
    description: "Individual and team performance",
    icon: Users,
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "conversion",
    title: "Conversion Report",
    description: "Pipeline conversion analytics",
    icon: ArrowRightLeft,
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    id: "monthly",
    title: "Monthly Report",
    description: "Month-over-month comparison",
    icon: Calendar,
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    id: "product",
    title: "Product Report",
    description: "Product sales and popularity",
    icon: Package,
    color: "bg-teal-500/10 text-teal-600",
  },
  {
    id: "pipeline",
    title: "Pipeline Report",
    description: "Pipeline health and aging",
    icon: Kanban,
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    id: "follow-up",
    title: "Follow-up Report",
    description: "Follow-up completion and efficiency",
    icon: CalendarClock,
    color: "bg-rose-500/10 text-rose-600",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function ReportsContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate insights from your business data
          </p>
        </div>
      </div>
      
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {reports.map((report) => {
          const Icon = report.icon;
          const isSupported = SUPPORTED_REPORT_TYPES.includes(report.id as ReportType);
          return (
            <motion.div key={report.id} variants={item}>
              <Link href={`/reports/${report.id}`} className="block h-full">
                <Card className="h-full rounded-xl hover:shadow-md transition-[box-shadow,border-color] duration-200 border-border/50 hover:border-primary/20 group">
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className={`p-3 rounded-xl ${report.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{report.title}</CardTitle>
                        {!isSupported && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Not available
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-base line-clamp-2 min-h-[3rem]">
                      {report.description}
                    </CardDescription>
                    <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View Report
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
