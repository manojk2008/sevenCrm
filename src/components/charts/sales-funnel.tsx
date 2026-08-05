'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ChartSkeleton } from '@/components/shared/skeleton-loader';
import { cn } from '@/lib/utils';

interface FunnelData {
  stage: string;
  count: number;
  value: number;
  color: string;
}

interface SalesFunnelProps {
  data: FunnelData[];
  loading?: boolean;
}

export function SalesFunnel({ data, loading }: SalesFunnelProps) {
  if (loading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data available</div>;
  }

  const maxCount = Math.max(...data.map(d => d.count));
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full py-4 flex flex-col space-y-2">
      {data.map((item, index) => {
        const width = `${Math.max((item.count / maxCount) * 100, 10)}%`;
        const prevItem = index > 0 ? data[index - 1] : null;
        const conversionRate = prevItem && prevItem.count > 0
          ? Math.round((item.count / prevItem.count) * 100)
          : null;

        return (
          <React.Fragment key={item.stage}>
            {conversionRate !== null && (
              <div className="flex justify-center my-1">
                <div className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center">
                  ↓ {conversionRate}% conversion
                </div>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="flex items-center gap-4 w-full"
            >
              <div className="w-32 text-sm font-medium text-right truncate pr-2">
                {item.stage}
              </div>
              <div className="flex-1 flex justify-center">
                <div
                  className="h-10 rounded-sm relative group flex items-center justify-center transition-all duration-300"
                  style={{ width, backgroundColor: item.color }}
                >
                  <span className="text-white font-medium text-sm z-10 drop-shadow-md">
                    {item.count}
                  </span>
                </div>
              </div>
              <div className="w-24 text-sm font-semibold text-left pl-2">
                {formatCurrency(item.value)}
              </div>
            </motion.div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
