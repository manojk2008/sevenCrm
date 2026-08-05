"use client";

import React, { useState, useEffect } from 'react';
import { KpiCards } from './kpi-cards';
import { RevenueChartSection } from './revenue-chart-section';
import { SalesFunnelSection } from './sales-funnel-section';
import { PipelineSnapshot } from './pipeline-snapshot';
import { RecentActivities } from './recent-activities';
import { UpcomingFollowUps } from './upcoming-follow-ups';
import { ExecutiveLeaderboard } from './executive-leaderboard';
import { LeadSourcesChart } from './lead-sources-chart';
import { TodaysTasks } from './todays-tasks';
import { MonthlyComparison } from './monthly-comparison';
import { QuickActions } from './quick-actions';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          {greeting}, Admin
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground"
        >
          Here&apos;s what&apos;s happening with your business today. {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </motion.p>
      </div>

      <KpiCards />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7">
          <RevenueChartSection />
        </div>
        <div className="md:col-span-5">
          <SalesFunnelSection />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col">
          <PipelineSnapshot />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <RecentActivities />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <UpcomingFollowUps />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ExecutiveLeaderboard />
        </div>
        <div className="lg:col-span-5">
          <LeadSourcesChart />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        <div className="lg:col-span-4 flex flex-col">
          <TodaysTasks />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <MonthlyComparison />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
