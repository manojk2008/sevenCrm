"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Widths are the funnel's proportions; colours come from the pipeline stage
// tokens so the dashboard and the Enquiries board name each stage the same way.
const funnelData = [
  { stage: 'New', count: 45, color: 'var(--stage-new)', width: '100%' },
  { stage: 'Contacted', count: 38, color: 'var(--stage-contacted)', width: '85%' },
  { stage: 'Follow-up', count: 28, color: 'var(--stage-followup)', width: '70%' },
  { stage: 'Quotation', count: 20, color: 'var(--stage-quotation)', width: '55%' },
  { stage: 'Negotiation', count: 14, color: 'var(--stage-negotiation)', width: '40%' },
  { stage: 'Won', count: 6, color: 'var(--stage-won)', width: '25%' },
];

const totalLeads = funnelData[0].count;
const wonCount = funnelData[funnelData.length - 1].count;
const winRate = ((wonCount / totalLeads) * 100).toFixed(1);

export function SalesFunnelSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Card className="flex h-full flex-col rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Sales Pipeline</CardTitle>
        <CardDescription>Current stage conversion</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center px-6 py-4">
        {/* Label / bar / count columns — the bar carries the proportion, so the
            stage name never has to shrink with it. */}
        <div className="flex flex-col gap-2.5">
          {funnelData.map((item, idx) => (
            <div key={item.stage} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
              <span className="truncate text-sm text-muted-foreground">{item.stage}</span>

              <div className="h-7 w-full overflow-hidden rounded-md bg-muted/60">
                <motion.div
                  initial={shouldReduceMotion ? false : { width: 0 }}
                  animate={{ width: item.width }}
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
            <div>Total Leads</div>
          </div>
          <div className="text-center">
            <div className="font-semibold tabular-nums text-success">{winRate}%</div>
            <div>Win Rate</div>
          </div>
          <div className="text-center">
            <div className="font-semibold tabular-nums text-foreground">~14 days</div>
            <div>Avg Cycle</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
