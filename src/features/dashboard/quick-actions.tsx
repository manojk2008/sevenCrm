"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, TrendingUp, FileText, CalendarClock, BarChart3, Kanban } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const actions = [
  { icon: Building2, label: 'New Client', href: '/clients/new', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { icon: TrendingUp, label: 'New Enquiry', href: '/enquiries/new', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  { icon: FileText, label: 'Quotation', href: '/quotations/new', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  { icon: CalendarClock, label: 'Follow-up', href: '/tasks', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  { icon: BarChart3, label: 'Reports', href: '/reports', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' },
  { icon: Kanban, label: 'Pipeline', href: '/pipeline', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' },
];

export function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          <CardDescription>Fast access to common tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {actions.map((action, idx) => (
              <Link key={idx} href={action.href}>
                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group cursor-pointer h-full gap-2 text-center">
                  <div className={cn("p-2.5 rounded-full transition-transform group-hover:scale-110", action.color)}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {action.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
