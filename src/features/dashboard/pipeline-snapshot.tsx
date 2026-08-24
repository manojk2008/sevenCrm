"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const pipelineData = [
  { name: 'Discovery', count: 12, value: 4500000, color: 'bg-slate-300 dark:bg-slate-700' },
  { name: 'Proposal', count: 8, value: 3200000, color: 'bg-blue-400' },
  { name: 'Negotiation', count: 5, value: 2800000, color: 'bg-indigo-500' },
  { name: 'Closing', count: 3, value: 1500000, color: 'bg-emerald-500' },
];

const totalValue = pipelineData.reduce((acc, curr) => acc + curr.value, 0);

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export function PipelineSnapshot() {
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
          <CardDescription>Value distribution by stage</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-1">Total Pipeline Value</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {formatCurrency(totalValue)}
            </p>
          </div>
          
          <div className="h-4 w-full flex rounded-full overflow-hidden mb-6 shadow-sm">
            {pipelineData.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / totalValue) * 100}%` }}
                transition={{ delay: 0.8 + (i * 0.1), duration: 0.5 }}
                className={`${item.color} h-full border-r border-white/20 last:border-r-0`}
                title={`${item.name}: ${formatCurrency(item.value)}`}
              />
            ))}
          </div>
          
          <div className="space-y-3">
            {pipelineData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">
                    {item.count} deals
                  </span>
                </div>
                <div className="font-semibold">
                  {formatCurrency(item.value)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
