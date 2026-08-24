"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeleton-loader";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/format";
import { getRevenueByPeriod, getSalesErrorMessage } from "@/features/sales/api";
import type { RevenueByPeriod } from "@/types/sales";

type Period = "monthly" | "quarterly" | "yearly";

interface ChartPoint {
  name: string;
  revenue: number;
}

/**
 * Quarterly/yearly views are real, derived-client-side sums of the backend's
 * real monthly buckets — never a second, independently-computed figure. The
 * backend only ever buckets by month (see SalesService.getRevenueByPeriod),
 * so this is the honest way to offer a wider granularity without inventing
 * a quarterly/yearly aggregation query.
 */
function toChartData(buckets: RevenueByPeriod["buckets"], period: Period): ChartPoint[] {
  if (period === "monthly") {
    return buckets.slice(-12).map((b) => ({
      name: new Date(b.periodStart).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue: b.netAcceptedRevenue,
    }));
  }

  const groups = new Map<string, { label: string; revenue: number; sortKey: number }>();
  for (const bucket of buckets) {
    const date = new Date(bucket.periodStart);
    const year = date.getUTCFullYear();
    let key: string;
    let label: string;
    let sortKey: number;
    if (period === "quarterly") {
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      key = `${year}-Q${quarter}`;
      label = `Q${quarter} ${year}`;
      sortKey = year * 10 + quarter;
    } else {
      key = `${year}`;
      label = `${year}`;
      sortKey = year;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.revenue += bucket.netAcceptedRevenue;
    } else {
      groups.set(key, { label, revenue: bucket.netAcceptedRevenue, sortKey });
    }
  }
  return Array.from(groups.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((g) => ({ name: g.label, revenue: g.revenue }));
}

export function RevenueChartSection() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [buckets, setBuckets] = useState<RevenueByPeriod["buckets"] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        // Two years of monthly history is enough to populate every view
        // (12 months / 8 quarters / 2 years) from one fetch.
        const from = new Date();
        from.setUTCFullYear(from.getUTCFullYear() - 2);
        from.setUTCDate(1);
        const result = await getRevenueByPeriod({ from: from.toISOString() });
        if (cancelled) return;
        setBuckets(result.buckets);
        setErrorMessage("");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getSalesErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => (buckets ? toChartData(buckets, period) : []), [buckets, period]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
            <CardDescription>Net accepted revenue by month raised</CardDescription>
          </div>
          <div className="flex bg-muted rounded-lg p-1">
            {(["monthly", "quarterly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400"
                    : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4 px-2 min-h-[300px]">
          {isLoading ? (
            <ChartSkeleton />
          ) : errorMessage ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {errorMessage}
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No accepted quotations yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => `₹${value / 100000}L`}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value) =>
                    formatCurrency(typeof value === "number" ? value : Number(value ?? 0))
                  }
                  contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Net accepted revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "var(--chart-1)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
