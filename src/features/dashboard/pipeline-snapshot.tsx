"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeleton-loader";
import { formatCurrency } from "@/lib/format";
import { getSalesSummary, getSalesErrorMessage } from "@/features/sales/api";
import type { EnquiryStageBucket } from "@/types/sales";

// Open stages only — "pipeline" means still in progress, so won/lost (final
// outcomes) are excluded. Same colour tokens as the Enquiries Kanban board.
const PIPELINE_STAGES: { stage: EnquiryStageBucket["stage"]; label: string; color: string }[] = [
  { stage: "new", label: "New", color: "var(--stage-new)" },
  { stage: "contacted", label: "Contacted", color: "var(--stage-contacted)" },
  { stage: "follow-up", label: "Follow-up", color: "var(--stage-followup)" },
  { stage: "quotation-sent", label: "Quotation", color: "var(--stage-quotation)" },
  { stage: "negotiation", label: "Negotiation", color: "var(--stage-negotiation)" },
];

interface PipelineRow {
  stage: string;
  label: string;
  color: string;
  count: number;
  expectedRevenue: number;
}

export function PipelineSnapshot() {
  const [rows, setRows] = useState<PipelineRow[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const summary = await getSalesSummary();
        if (cancelled) return;
        const byStage = new Map(summary.enquiryStageBreakdown.map((b) => [b.stage, b]));
        setRows(
          PIPELINE_STAGES.map((s) => {
            const bucket = byStage.get(s.stage);
            return {
              stage: s.stage,
              label: s.label,
              color: s.color,
              count: bucket?.count ?? 0,
              expectedRevenue: bucket?.expectedRevenue ?? 0,
            };
          }),
        );
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

  const totalValue = rows?.reduce((acc, r) => acc + r.expectedRevenue, 0) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-xl shadow-sm flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Pipeline Snapshot</CardTitle>
          <CardDescription>Expected value by stage (forecast, not revenue)</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          {isLoading ? (
            <ChartSkeleton />
          ) : errorMessage ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{errorMessage}</p>
          ) : !rows || totalValue === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No open enquiries with expected revenue yet.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Total Expected Pipeline Value</p>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(totalValue)}
                </p>
              </div>

              <div className="h-4 w-full flex rounded-full overflow-hidden mb-6 shadow-sm">
                {rows
                  .filter((r) => r.expectedRevenue > 0)
                  .map((item, i) => (
                    <motion.div
                      key={item.stage}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.expectedRevenue / totalValue) * 100}%` }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                      style={{ backgroundColor: item.color }}
                      className="h-full border-r border-white/20 last:border-r-0"
                      title={`${item.label}: ${formatCurrency(item.expectedRevenue)}`}
                    />
                  ))}
              </div>

              <div className="space-y-3">
                {rows.map((item) => (
                  <div key={item.stage} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.count} {item.count === 1 ? "enquiry" : "enquiries"}
                      </span>
                    </div>
                    <div className="font-semibold">{formatCurrency(item.expectedRevenue)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
