"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Leads', current: 145, previous: 110 },
  { name: 'Meetings', current: 52, previous: 48 },
  { name: 'Quotes', current: 35, previous: 22 },
  { name: 'Wins', current: 14, previous: 8 },
];

export function MonthlyComparison() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="flex-1 h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-semibold">Performance Comparison</CardTitle>
          <CardDescription>This month vs last month</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[260px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
              />
              <Bar dataKey="previous" name="Last Month" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="current" name="This Month" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
