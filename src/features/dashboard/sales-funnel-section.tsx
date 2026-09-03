"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeleton-loader";
import { formatPercentage } from "@/lib/format";
import { getSalesSummary, getSalesErrorMessage } from "@/features/sales/api";
import type { EnquiryStageBucket } from "@/types/sales";

// Same stage set/order/colour tokens as the Enquiries Kanban board, minus
// "lost" — this is the forward funnel, not the lost branch.
const FUNNEL_STAGES: { stage: EnquiryStageBucket["stage"]; label: string; color: string }[] = [
  { stage: "new", label: "New", color: "var(--stage-new)" },
  { stage: "contacted", label: "Contacted", color: "var(--stage-contacted)" },
  { stage: "follow-up-1", label: "Follow-up 1", color: "var(--stage-followup-1)" },
  { stage: "follow-up-2", label: "Follow-up 2", color: "var(--stage-followup-2)" },
  { stage: "follow-up-3", label: "Follow-up 3", color: "var(--stage-followup-3)" },
  { stage: "won", label: "Won", color: "var(--stage-won)" },
];

interface FunnelRow {
  stage: string;
  label: string;
  color: string;
  count: number;
  widthPct: number;
}

export function SalesFunnelSection() {
  const shouldReduceMotion = useReducedMotion();
  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [winRate, setWinRate] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const summary = await getSalesSummary();
        if (cancelled) return;
        const byStage = new Map(summary.enquiryStageBreakdown.map((b) => [b.stage, b.count]));
        const counts = FUNNEL_STAGES.map((s) => byStage.get(s.stage) ?? 0);
        const max = Math.max(...counts, 1);
        setRows(
          FUNNEL_STAGES.map((s, i) => ({
            stage: s.stage,
            label: s.label,
            color: s.color,
            count: counts[i],
            widthPct: Math.round((counts[i] / max) * 100),
          })),
        );
        setWinRate(summary.enquiryConversion.winRate);
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

  const totalLeads = rows?.[0]?.count ?? 0;

  return (
    <Card className="flex h-full flex-col rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Sales Pipeline</CardTitle>
        <CardDescription>Open enquiries by stage, right now</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center px-6 py-4">
        {isLoading ? (
          <ChartSkeleton />
        ) : errorMessage ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{errorMessage}</p>
        ) : !rows || totalLeads === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No enquiries yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {rows.map((item, idx) => (
                <div key={item.stage} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
                  <span className="truncate text-sm text-muted-foreground">{item.label}</span>

                  <div className="h-7 w-full overflow-hidden rounded-md bg-muted/60">
                    <motion.div
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${item.widthPct}%` }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { delay: 0.15 + idx * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                      }
                      style={{ backgroundColor: item.color }}
                      className="h-full rounded-md"
                    />
                  </div>

                  <span className="text-right text-sm font-medium tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <div className="text-center">
                <div className="font-semibold tabular-nums text-foreground">{totalLeads}</div>
                <div>New Enquiries</div>
              </div>
              <div className="text-center">
                <div className="font-semibold tabular-nums text-success">{formatPercentage(winRate)}</div>
                <div>Win Rate</div>
              </div>
              {/* Avg Cycle deliberately not shown as a number — no won/lost
                  timestamp exists to compute it from (same limitation Sales
                  documents on its own page). */}
              <div className="text-center">
                <div className="font-semibold tabular-nums text-muted-foreground/50">N/A</div>
                <div>Avg Cycle</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
