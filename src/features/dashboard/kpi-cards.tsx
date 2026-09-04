"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { StatCardSkeleton } from "@/components/shared/skeleton-loader";
import { Building2, Package, TrendingUp, Trophy, IndianRupee, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage, formatNumber } from "@/lib/format";
import { getDashboardSummary, getDashboardErrorMessage } from "./api";
import { getSalesSummary, getSalesErrorMessage } from "@/features/sales/api";

/** First instant of the current UTC month, ISO-8601 — matches the backend's own month bucketing (see SalesService.getRevenueByPeriod). */
function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

interface KpiValues {
  totalClients: number;
  totalProducts: number;
  openEnquiries: number;
  wonEnquiries: number;
  monthlyNetRevenue: number;
  winRate: number;
}

type LoadState = "loading" | "error" | "ready";

export function KpiCards() {
  const shouldReduceMotion = useReducedMotion();
  const [values, setValues] = useState<KpiValues | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const from = startOfCurrentMonthIso();
        // Snapshot totals (Dashboard) and "this month" performance (Sales)
        // are two different questions, so they're two separate calls rather
        // than one endpoint straining to answer both.
        const [summary, salesThisMonth] = await Promise.all([
          getDashboardSummary(),
          getSalesSummary({ from }),
        ]);
        if (cancelled) return;
        setValues({
          totalClients: summary.totalClients,
          totalProducts: summary.totalProducts,
          openEnquiries: summary.openEnquiries,
          wonEnquiries: salesThisMonth.enquiryConversion.won,
          monthlyNetRevenue: salesThisMonth.revenue.netAcceptedRevenue,
          winRate: salesThisMonth.enquiryConversion.winRate,
        });
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getDashboardErrorMessage(error) || getSalesErrorMessage(error));
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  if (state === "loading") {
    return (
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (state === "error" || !values) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Couldn&apos;t load dashboard KPIs. {errorMessage}
        </CardContent>
      </Card>
    );
  }

  const kpiData = [
    {
      title: "Total Clients",
      value: formatNumber(values.totalClients),
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/clients?status=all",
    },
    {
      title: "Total Products",
      value: formatNumber(values.totalProducts),
      icon: Package,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      href: "/products?status=all",
    },
    {
      title: "Open Enquiries",
      value: formatNumber(values.openEnquiries),
      icon: TrendingUp,
      color: "text-warning",
      bgColor: "bg-warning/10",
      href: "/enquiries",
    },
    {
      title: "Succeeded Enquiries (This Month)",
      value: formatNumber(values.wonEnquiries),
      icon: Trophy,
      color: "text-success",
      bgColor: "bg-success/10",
      href: "/enquiries?stage=won",
    },
    {
      title: "Net Revenue (This Month)",
      value: formatCurrency(values.monthlyNetRevenue),
      icon: IndianRupee,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/analytics",
    },
    {
      title: "Enquiry Success Rate (This Month)",
      value: formatPercentage(values.winRate),
      icon: Target,
      color: "text-info",
      bgColor: "bg-info/10",
      href: "/analytics",
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      {kpiData.map((kpi, idx) => (
        <motion.div key={idx} variants={item}>
          <Link href={kpi.href} className="block">
            <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                    <div className="flex items-baseline space-x-2">
                      <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                    </div>
                  </div>
                  <div className={cn("p-3 rounded-full transition-transform group-hover:scale-110", kpi.bgColor)}>
                    <kpi.icon className={cn("w-6 h-6", kpi.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
