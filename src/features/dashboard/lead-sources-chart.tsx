"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeleton-loader";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatNumber } from "@/lib/format";
import { getLeadSources, getDashboardErrorMessage } from "./api";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ChartSlice {
  name: string;
  value: number;
}

export function LeadSourcesChart() {
  const [slices, setSlices] = useState<ChartSlice[] | null>(null);
  const [totalLeads, setTotalLeads] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const result = await getLeadSources();
        if (cancelled) return;
        setSlices(
          result.sources
            .filter((s) => s.count > 0)
            .map((s) => ({ name: s.name, value: s.count })),
        );
        setTotalLeads(result.totalLeads);
        setErrorMessage("");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getDashboardErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8 }}
      className="h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-semibold">Lead Sources</CardTitle>
          <CardDescription>Where are enquiries coming from</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[300px] relative">
          {isLoading ? (
            <ChartSkeleton />
          ) : errorMessage ? (
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          ) : !slices || slices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enquiries yet.</p>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none pb-6">
                <span className="text-3xl font-bold text-foreground">{formatNumber(totalLeads)}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Total Leads
                </span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {slices.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatNumber(Number(value ?? 0)), name]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
