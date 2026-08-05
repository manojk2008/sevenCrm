'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartSkeleton } from '@/components/shared/skeleton-loader';

interface RevenueChartProps {
  data: { month: string; revenue: number; previousYear?: number }[];
  loading?: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return <ChartSkeleton />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₹${value / 1000}k`}
            dx={-10}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-sm">
                    <p className="mb-2 text-sm font-medium">{label}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-600" />
                        <span className="text-sm font-medium">
                          {formatCurrency(payload[0].value as number)}
                        </span>
                      </div>
                      {payload[1] && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-slate-400" />
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(payload[1].value as number)} (Prev)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {data[0]?.previousYear !== undefined && (
            <Area
              type="monotone"
              dataKey="previousYear"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorPrevious)"
            />
          )}
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#4f46e5"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
