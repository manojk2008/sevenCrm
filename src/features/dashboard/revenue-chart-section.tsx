"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const monthlyData = [
  { name: 'Apr', revenue: 6500000 },
  { name: 'May', revenue: 7200000 },
  { name: 'Jun', revenue: 8400000 },
  { name: 'Jul', revenue: 6900000 },
  { name: 'Aug', revenue: 9100000 },
  { name: 'Sep', revenue: 10500000 },
  { name: 'Oct', revenue: 9800000 },
  { name: 'Nov', revenue: 11200000 },
  { name: 'Dec', revenue: 12500000 },
  { name: 'Jan', revenue: 10900000 },
  { name: 'Feb', revenue: 11800000 },
  { name: 'Mar', revenue: 12450000 },
];

const quarterlyData = [
  { name: 'Q1', revenue: 22100000 },
  { name: 'Q2', revenue: 26500000 },
  { name: 'Q3', revenue: 33500000 },
  { name: 'Q4', revenue: 35150000 },
];

const yearlyData = [
  { name: '2021', revenue: 45000000 },
  { name: '2022', revenue: 72000000 },
  { name: '2023', revenue: 98000000 },
  { name: '2024', revenue: 117250000 },
];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export function RevenueChartSection() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  const data = period === 'monthly' ? monthlyData : period === 'quarterly' ? quarterlyData : yearlyData;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="h-full"
    >
      <Card className="h-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
            <CardDescription>Financial performance over time</CardDescription>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4 px-2 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
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
                tickFormatter={(value) => `₹${value / 1000000}M`}
                dx={-10}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#4f46e5" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
