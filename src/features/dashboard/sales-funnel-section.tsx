"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const funnelData = [
  { stage: 'New', count: 45, color: 'bg-blue-500', width: '100%' },
  { stage: 'Contacted', count: 38, color: 'bg-indigo-500', width: '85%' },
  { stage: 'Follow-up', count: 28, color: 'bg-violet-500', width: '70%' },
  { stage: 'Quotation', count: 20, color: 'bg-purple-500', width: '55%' },
  { stage: 'Negotiation', count: 14, color: 'bg-fuchsia-500', width: '40%' },
  { stage: 'Won', count: 6, color: 'bg-emerald-500', width: '25%' },
];

export function SalesFunnelSection() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Sales Pipeline</CardTitle>
          <CardDescription>Current stage conversion</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-6 py-4">
          <div className="space-y-3 w-full max-w-sm mx-auto flex flex-col items-center">
            {funnelData.map((item, idx) => (
              <motion.div 
                key={item.stage}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: item.width, opacity: 1 }}
                transition={{ delay: 0.5 + idx * 0.1, duration: 0.5 }}
                className={`${item.color} h-10 rounded-lg flex items-center justify-between px-4 text-white font-medium text-sm shadow-sm relative group`}
              >
                <span className="truncate pr-2">{item.stage}</span>
                <span className="font-bold bg-white/20 px-2 py-0.5 rounded text-xs">{item.count}</span>
                
                {/* Connecting lines for funnel effect */}
                {idx < funnelData.length - 1 && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 flex justify-between h-3 opacity-30">
                    <div className="w-[1px] h-full bg-slate-900 rotate-12 origin-top"></div>
                    <div className="w-[1px] h-full bg-slate-900 -rotate-12 origin-top"></div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-6 flex justify-between items-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
            <div className="text-center">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{funnelData[0].count}</div>
              <div>Total Leads</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">13.3%</div>
              <div>Win Rate</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-900 dark:text-slate-100">~14 days</div>
              <div>Avg Cycle</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
