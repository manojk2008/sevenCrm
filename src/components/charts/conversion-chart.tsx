'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartSkeleton } from '@/components/shared/skeleton-loader';

interface ConversionChartProps {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  loading?: boolean;
}

export function ConversionChart({
  data,
  centerLabel,
  centerValue,
  loading,
}: ConversionChartProps) {
  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <div className="h-[300px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const num = typeof value === 'number' ? value : Number(value ?? 0);
              return [`${num}%`, 'Conversion'];
            }}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              // ...rest unchanged
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-3xl font-bold tracking-tight">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-sm text-muted-foreground font-medium">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
