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
import { useAuthStore } from '@/stores/auth-store';

export function DashboardContent() {
  const { user } = useAuthStore();
  // Greeting and date both depend on the client clock, so they resolve after
  // mount. Only the two lines that need them wait — the dashboard itself
  // renders immediately rather than blanking the whole route.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting = React.useMemo(() => {
    if (!now) return null;
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [now]);

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting ? (firstName ? `${greeting}, ${firstName}` : greeting) : 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
          {now ? ` ${format(now, 'EEEE, MMMM do, yyyy')}` : ''}
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
