"use client";

/**
 * Analytics — real data composed from /analytics/summary, /sales/summary,
 * /sales/revenue-by-period, /sales/revenue-by-representative, and
 * /dashboard/lead-sources. No figure here is a second implementation of
 * anything Sales or Dashboard already computes (Phase 8 decision D6).
 *
 * The Week/Month/Quarter/Year selector genuinely re-requests the KPI
 * scorecard, sales funnel, lead sources, and representative chart with a
 * different `from` date — it does not just switch a local tab. The revenue
 * comparison chart is the one exception: it always shows the last 12
 * calendar months against the 12 before that (a real, derived-from-real-
 * monthly-buckets overlay), independent of the selector, and is captioned
 * as such so that's never ambiguous.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartSkeleton, StatCardSkeleton } from "@/components/shared/skeleton-loader";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/format";
import { TrendingUp, Users, Target, IndianRupee, Ban, type LucideIcon } from "lucide-react";
import { getAnalyticsSummary, getAnalyticsErrorMessage } from "./api";
import { getSalesSummary, getRevenueByPeriod, getRevenueByRepresentative, getSalesErrorMessage } from "@/features/sales/api";
import { getLeadSources, getDashboardErrorMessage } from "@/features/dashboard/api";
import type { SalesSummary, RevenueByRepresentative } from "@/types/sales";
import type { UnavailableMetric } from "@/types/analytics";

type Period = "week" | "month" | "quarter" | "year";

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365 };

const PERIOD_LABEL: Record<Period, string> = {
  week: "the last 7 days",
  month: "the last 30 days",
  quarter: "the last 90 days",
  year: "the last 12 months",
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ScopedData {
  salesSummary: SalesSummary;
  newLeads: number;
  byRepresentative: RevenueByRepresentative[];
  leadSources: { name: string; value: number }[];
}

interface TrendPoint {
  name: string;
  thisPeriod: number;
  lastPeriod: number;
}

function UnavailableStat({ metric }: { metric: UnavailableMetric }) {
  return (
    <Card className="rounded-xl border-dashed shadow-none bg-muted/30">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
          <Ban className="w-4 h-4 text-muted-foreground/60" />
        </div>
        <div>
          <div className="text-lg font-semibold text-muted-foreground/70">Not available</div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{metric.reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTile({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsContent() {
  const [period, setPeriod] = useState<Period>("month");
  const [scoped, setScoped] = useState<ScopedData | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableMetric[]>([]);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      const from = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
      try {
        const [salesSummary, analyticsSummary, byRepresentative, leadSourceResult] = await Promise.all([
          getSalesSummary({ from }),
          getAnalyticsSummary({ from }),
          getRevenueByRepresentative({ from, limit: 8 }),
          getLeadSources({ from }),
        ]);
        if (cancelled) return;
        setScoped({
          salesSummary,
          newLeads: analyticsSummary.newEnquiries,
          byRepresentative,
          leadSources: leadSourceResult.sources
            .filter((s) => s.count > 0)
            .map((s) => ({ name: s.name, value: s.count })),
        });
        setUnavailable(analyticsSummary.unavailableMetrics);
        setErrorMessage("");
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          getAnalyticsErrorMessage(error) || getSalesErrorMessage(error) || getDashboardErrorMessage(error),
        );
        setLoadState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  // The comparison trend is intentionally independent of `period` — see the
  // file header comment for why.
  useEffect(() => {
    let cancelled = false;
    async function loadTrend() {
      try {
        const from = new Date();
        from.setUTCFullYear(from.getUTCFullYear() - 2);
        from.setUTCDate(1);
        const result = await getRevenueByPeriod({ from: from.toISOString() });
        if (cancelled) return;

        const now = new Date();
        const points: TrendPoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          const priorYearDate = new Date(
            Date.UTC(monthDate.getUTCFullYear() - 1, monthDate.getUTCMonth(), 1),
          );
          const findRevenue = (target: Date) =>
            result.buckets.find(
              (b) =>
                new Date(b.periodStart).getUTCFullYear() === target.getUTCFullYear() &&
                new Date(b.periodStart).getUTCMonth() === target.getUTCMonth(),
            )?.netAcceptedRevenue ?? 0;
          points.push({
            name: MONTH_LABELS[monthDate.getUTCMonth()],
            thisPeriod: findRevenue(monthDate),
            lastPeriod: findRevenue(priorYearDate),
          });
        }
        setTrend(points);
      } catch {
        if (!cancelled) setTrend(null);
      }
    }
    void loadTrend();
    return () => {
      cancelled = true;
    };
  }, []);

  const unavailableByKey = useMemo(() => new Map(unavailable.map((m) => [m.key, m])), [unavailable]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Deep dive into your business metrics — {PERIOD_LABEL[period]}.
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="week" className="rounded-lg">Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg">Month</TabsTrigger>
            <TabsTrigger value="quarter" className="rounded-lg">Quarter</TabsTrigger>
            <TabsTrigger value="year" className="rounded-lg">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loadState === "loading" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {loadState === "error" && (
        <Card className="rounded-xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{errorMessage}</CardContent>
        </Card>
      )}

      {loadState === "ready" && scoped && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiTile title="Net Revenue" value={formatCurrency(scoped.salesSummary.revenue.netAcceptedRevenue)} icon={IndianRupee} />
            <KpiTile title="New Leads" value={formatNumber(scoped.newLeads)} icon={Users} />
            <KpiTile title="Enquiry Win Rate" value={formatPercentage(scoped.salesSummary.enquiryConversion.winRate)} icon={Target} />
            <KpiTile title="Avg Deal Size" value={formatCurrency(scoped.salesSummary.revenue.averageAcceptedValue)} icon={TrendingUp} />
            {unavailableByKey.has("salesVelocity") && <UnavailableStat metric={unavailableByKey.get("salesVelocity")!} />}
            {unavailableByKey.has("cac") && <UnavailableStat metric={unavailableByKey.get("cac")!} />}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                  Last 12 calendar months vs the same 12 months a year earlier, by when each
                  quotation was raised.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!trend ? (
                    <ChartSkeleton />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend}>
                        <defs>
                          <linearGradient id="colorThisPeriod" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => `₹${v / 100000}L`} />
                        <Tooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
                        <Legend />
                        <Area type="monotone" dataKey="thisPeriod" name="Last 12 months" stroke="var(--primary)" fill="url(#colorThisPeriod)" />
                        <Area type="monotone" dataKey="lastPeriod" name="12 months before that" stroke="var(--muted-foreground)" fill="none" strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Sales Funnel</CardTitle>
                <CardDescription>Open enquiries by stage — {PERIOD_LABEL[period]}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center flex-col gap-2">
                  {(() => {
                    const stages = scoped.salesSummary.enquiryStageBreakdown.filter(
                      (b) => b.stage !== "lost",
                    );
                    const max = Math.max(...stages.map((s) => s.count), 1);
                    if (stages.every((s) => s.count === 0)) {
                      return <p className="text-sm text-muted-foreground">No enquiries in this period.</p>;
                    }
                    return stages.map((s) => (
                      <div key={s.stage} className="w-full flex items-center gap-4">
                        <div className="w-24 text-sm font-medium text-right capitalize">
                          {s.stage.replace("-", " ")}
                        </div>
                        <div className="flex-1 flex items-center">
                          <div
                            className="h-10 bg-primary rounded-r-full rounded-l-sm flex items-center px-4 text-primary-foreground text-sm font-bold shadow-sm transition-all"
                            style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 8 : 0)}%` }}
                          >
                            {s.count > 0 && s.count}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
                <CardDescription>{PERIOD_LABEL[period]}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {scoped.leadSources.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No enquiries in this period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={scoped.leadSources} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                          {scoped.leadSources.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [formatNumber(Number(value ?? 0)), name]} />
                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Revenue by Representative</CardTitle>
                <CardDescription>{PERIOD_LABEL[period]}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {scoped.byRepresentative.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No accepted quotations in this period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={scoped.byRepresentative.map((r) => ({ name: r.name, revenue: r.netAcceptedRevenue }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `₹${v / 100000}L`} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
                        <Bar dataKey="revenue" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
