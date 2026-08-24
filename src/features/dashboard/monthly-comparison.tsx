"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeleton-loader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getMonthlyComparison, getDashboardErrorMessage } from "./api";
import type { MonthlyComparison as MonthlyComparisonData } from "@/types/dashboard";

interface ChartRow {
  name: string;
  current: number;
  previous: number;
}

function toChartData(data: MonthlyComparisonData): ChartRow[] {
  return [
    { name: "Leads", current: data.current.leads, previous: data.previous.leads },
    { name: "Meetings", current: data.current.meetings, previous: data.previous.meetings },
    { name: "Quotes", current: data.current.quotes, previous: data.previous.quotes },
    { name: "Wins", current: data.current.wins, previous: data.previous.wins },
  ];
}

export function MonthlyComparison() {
  const [rows, setRows] = useState<ChartRow[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const result = await getMonthlyComparison();
        if (cancelled) return;
        setRows(toChartData(result));
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-semibold">Performance Comparison</CardTitle>
          <CardDescription>This month vs last month, by when each was raised/completed</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[260px] pt-4">
          {isLoading ? (
            <ChartSkeleton />
          ) : errorMessage ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {errorMessage}
            </div>
          ) : !rows ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }} />
                <Bar dataKey="previous" name="Last Month" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="current" name="This Month" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
