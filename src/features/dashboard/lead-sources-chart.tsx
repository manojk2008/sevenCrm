"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const data = [
  { name: 'Website', value: 35, color: 'var(--chart-1)' },
  { name: 'Referral', value: 25, color: 'var(--chart-3)' },
  { name: 'Cold Call', value: 15, color: 'var(--chart-4)' },
  { name: 'Social Media', value: 10, color: 'var(--chart-2)' },
  { name: 'Trade Show', value: 8, color: 'var(--chart-5)' },
  { name: 'Other', value: 7, color: 'var(--muted-foreground)' },
];

const totalLeads = data.reduce((acc, curr) => acc + curr.value, 0) * 12; // Just to make it a bigger number

export function LeadSourcesChart() {
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
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none pb-6">
            <span className="text-3xl font-bold text-foreground">{totalLeads}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Leads</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const num = typeof value === 'number' ? value : Number(value ?? 0);
                  return [`${num}%`, 'Share'];
                }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px...' /* keep the rest unchanged */ }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
