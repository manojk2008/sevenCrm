"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, getInitials } from "@/lib/format";
import { getRevenueByRepresentative, getSalesErrorMessage } from "@/features/sales/api";
import type { RevenueByRepresentative } from "@/types/sales";

export function ExecutiveLeaderboard() {
  const [rows, setRows] = useState<RevenueByRepresentative[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const result = await getRevenueByRepresentative({ limit: 10 });
        if (cancelled) return;
        setRows(result);
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.7 }}
      className="h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Executive Leaderboard
            <Trophy className="w-4 h-4 text-amber-500" />
          </CardTitle>
          <CardDescription>Ranked by net accepted revenue, all time</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : errorMessage ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{errorMessage}</p>
          ) : !rows || rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No accepted quotations yet.
            </p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">Rank</th>
                  <th className="px-6 py-3 font-semibold">Representative</th>
                  <th className="px-6 py-3 font-semibold text-center">Accepted</th>
                  <th className="px-6 py-3 font-semibold text-right">Net Revenue</th>
                  <th className="px-6 py-3 font-semibold text-right">Avg Deal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.userId ?? "unassigned"}
                    className="bg-white dark:bg-transparent border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          idx === 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : idx === 1
                              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : idx === 2
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                                : "text-slate-500",
                        )}
                      >
                        #{idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner shrink-0",
                            idx === 0
                              ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                              : "bg-slate-300 dark:bg-slate-700 text-foreground",
                          )}
                        >
                          {getInitials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{row.name}</p>
                          {row.email && (
                            <p className="text-[11px] text-muted-foreground truncate">{row.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs">
                        {row.acceptedQuotationCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(row.netAcceptedRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {formatCurrency(
                        row.acceptedQuotationCount > 0
                          ? row.netAcceptedRevenue / row.acceptedQuotationCount
                          : 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
