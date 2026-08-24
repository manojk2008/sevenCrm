import * as React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatCardSkeleton } from './skeleton-loader';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  href?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-indigo-600',
  href,
  loading,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden',
        href ? 'cursor-pointer' : ''
      )}
    >
      <div className="flex items-center justify-between space-x-4">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
        </div>
        <div className={cn('p-3 rounded-full bg-muted/50 flex items-center justify-center', iconColor)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      
      {(change !== undefined || changeLabel) && (
        <div className="mt-4 flex items-center space-x-2 text-sm">
          {change !== undefined && (
            <span
              className={cn(
                'flex items-center font-medium',
                isPositive ? 'text-emerald-600' : '',
                isNegative ? 'text-rose-600' : ''
              )}
            >
              {isPositive && <TrendingUp className="mr-1 h-4 w-4" />}
              {isNegative && <TrendingDown className="mr-1 h-4 w-4" />}
              {Math.abs(change)}%
            </span>
          )}
          {changeLabel && (
            <span className="text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
