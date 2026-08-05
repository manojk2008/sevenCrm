"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Package, TrendingUp, Trophy, IndianRupee, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const kpiData = [
  {
    title: "Total Clients",
    value: "25",
    change: "+12%",
    changeType: "positive",
    icon: Building2,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/20",
  },
  {
    title: "Total Products",
    value: "30",
    change: "+5%",
    changeType: "positive",
    icon: Package,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/20",
  },
  {
    title: "Open Enquiries",
    value: "32",
    change: "-3%",
    changeType: "negative",
    icon: TrendingUp,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/20",
  },
  {
    title: "Won Deals",
    value: "6",
    change: "+25%",
    changeType: "positive",
    icon: Trophy,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/20",
  },
  {
    title: "Monthly Revenue",
    value: "₹1,24,50,000",
    change: "+18%",
    changeType: "positive",
    icon: IndianRupee,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
  },
  {
    title: "Conversion Rate",
    value: "18.7%",
    change: "+2.3%",
    changeType: "positive",
    icon: Target,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/20",
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function KpiCards() {
  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      {kpiData.map((kpi, idx) => (
        <motion.div key={idx} variants={item}>
          <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                  </div>
                  <p className={cn(
                    "text-xs font-medium",
                    kpi.changeType === 'positive' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {kpi.change} <span className="text-muted-foreground font-normal">vs last month</span>
                  </p>
                </div>
                <div className={cn("p-3 rounded-full transition-transform group-hover:scale-110", kpi.bgColor)}>
                  <kpi.icon className={cn("w-6 h-6", kpi.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
