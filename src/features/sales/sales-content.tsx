"use client";

/**
 * Sales — a read-only reporting view over the existing CRM records.
 *
 * Every number on this page comes from the /sales/* endpoints, which derive
 * them from real Enquiry / Quotation / QuotationLineItem rows. There is no
 * mock data, no fallback dataset, and no client-side estimation: if the
 * backend returns nothing, this page shows an empty state rather than a
 * demonstration figure.
 *
 * Two labelling rules this file must keep honouring:
 *
 *  1. "Net Accepted Revenue" (subtotal − discount) is the headline; "Gross
 *     Accepted Value" (grandTotal) includes tax and is always labelled as
 *     such. They are never used interchangeably.
 *  2. The database records no acceptance timestamp, so every period-scoped
 *     figure — including the trend chart — is a *quotation-raised-date*
 *     cohort. It must never be captioned "closed", "won", or "realized" in
 *     a period. The backend returns `period.basis` so this cannot drift.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  BadgeIndianRupee,
  BarChart3,
  Ban,
  FileText,
  Info,
  Package,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  ChartSkeleton,
  StatCardSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loader";
import { ApiError } from "@/lib/api";
import { formatCurrency, formatPercentage } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";
import type {
  LostEnquiry,
  RevenueByClient,
  RevenueByPeriod,
  RevenueByProduct,
  RevenueByRepresentative,
  SalesSummary,
} from "@/types/sales";
import {
  getLostEnquiries,
  getRevenueByClient,
  getRevenueByPeriod,
  getRevenueByProduct,
  getRevenueByRepresentative,
  getSalesErrorMessage,
  getSalesSummary,
} from "./api";

type LoadState = "loading" | "error" | "ready";

type TabValue = "revenue" | "conversion" | "representatives";

const BREAKDOWN_LIMIT = 10;
const LOST_PAGE_SIZE = 10;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Preset windows, all applied to the date each quotation was *raised*. */
const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "30", label: "Raised in last 30 days" },
  { value: "90", label: "Raised in last 90 days" },
  { value: "365", label: "Raised in last 12 months" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function periodToParams(period: PeriodValue): { from?: string } {
  if (period === "all") return {};
  const days = Number(period);
  return { from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() };
}

/**
 * A metric the database cannot support. Rendered explicitly rather than as a
 * zero — a zero would read as "there were none", which is a different and
 * false claim.
 */
function UnavailableStat({ label, reason }: { label: string; reason: string }) {
  return (
    <Card className="rounded-xl border-dashed shadow-none bg-muted/30">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Ban className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="mt-2">
          <h3 className="text-lg font-semibold text-muted-foreground/70">Not available</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SalesContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.user?.role);
  const isSalesExec = role === "sales-executive";

  const [period, setPeriod] = useState<PeriodValue>("all");
  const [tab, setTab] = useState<TabValue>("revenue");

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [byPeriod, setByPeriod] = useState<RevenueByPeriod | null>(null);
  const [byClient, setByClient] = useState<RevenueByClient[]>([]);
  const [byProduct, setByProduct] = useState<RevenueByProduct[]>([]);
  const [byRep, setByRep] = useState<RevenueByRepresentative[]>([]);
  const [lostEnquiries, setLostEnquiries] = useState<LostEnquiry[]>([]);
  const [lostTotal, setLostTotal] = useState(0);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const loadSales = useCallback(async () => {
    setLoadState("loading");
    const params = periodToParams(period);
    try {
      // Six independent reads issued together rather than sequentially — the
      // endpoints are deliberately focused, so the page must not pay for that
      // with six round trips in series.
      const [summaryResult, periodResult, clientResult, productResult, repResult, lostResult] =
        await Promise.all([
          getSalesSummary(params),
          getRevenueByPeriod(params),
          getRevenueByClient({ ...params, limit: BREAKDOWN_LIMIT }),
          getRevenueByProduct({ ...params, limit: BREAKDOWN_LIMIT }),
          getRevenueByRepresentative({ ...params, limit: BREAKDOWN_LIMIT }),
          getLostEnquiries({ ...params, page: 1, pageSize: LOST_PAGE_SIZE }),
        ]);

      setSummary(summaryResult);
      setByPeriod(periodResult);
      setByClient(clientResult);
      setByProduct(productResult);
      setByRep(repResult);
      setLostEnquiries(lostResult.data);
      setLostTotal(lostResult.total);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getSalesErrorMessage(error));
      setLoadState("error");
    }
  }, [period, handleUnauthorized]);

  useEffect(() => {
    Promise.resolve().then(loadSales);
  }, [loadSales]);

  const unavailableByKey = new Map(
    (summary?.unavailableMetrics ?? []).map((metric) => [metric.key, metric]),
  );

  const periodCaption =
    period === "all"
      ? "All quotations, regardless of when they were raised."
      : `Quotations raised in the ${PERIOD_OPTIONS.find((o) => o.value === period)?.label.replace("Raised in ", "")}.`;

  const hasAnyRevenue = (summary?.revenue.acceptedQuotationCount ?? 0) > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Sales"
        description="Revenue and conversion, derived from accepted quotations and enquiry outcomes."
        className="mb-0"
      >
        <Select value={period} onValueChange={(value) => setPeriod(value as PeriodValue)}>
          <SelectTrigger className="w-[240px]">
            {/* Base UI's Select.Value renders the raw *value* unless it is given
                a formatter (or an `items` map on the Root), so the label is
                resolved explicitly here — otherwise the trigger reads "all". */}
            <SelectValue placeholder="Period">
              {(value) =>
                PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? "Period"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* The single most important caption on the page: what "period" means. */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-medium text-foreground">Revenue from quotations raised in this period.</span>{" "}
          {periodCaption} No acceptance date is recorded in the system, so figures are grouped by
          when each quotation was raised — not by when it was accepted or closed.
        </p>
      </div>

      {loadState === "error" && (
        <ErrorState
          title="Couldn't load sales data"
          description="We couldn't reach the sales reporting service."
          showDetails
          errorMessage={loadErrorMessage}
          onRetry={loadSales}
        />
      )}

      {loadState === "loading" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <ChartSkeleton />
        </div>
      )}

      {loadState === "ready" && summary && (
        <>
          {/* ---------------------------------------------------- KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Net Accepted Revenue"
              value={formatCurrency(summary.revenue.netAcceptedRevenue)}
              icon={BadgeIndianRupee}
              iconColor="text-emerald-600"
            />
            <StatCard
              title="Gross Accepted Value"
              value={formatCurrency(summary.revenue.grossAcceptedValue)}
              icon={FileText}
              iconColor="text-sky-600"
            />
            <StatCard
              title="Accepted Quotations"
              value={summary.revenue.acceptedQuotationCount}
              icon={TrendingUp}
              iconColor="text-indigo-600"
            />
            <StatCard
              title="Quotation Acceptance Rate"
              value={formatPercentage(summary.quotationAcceptanceRate.rate)}
              icon={Percent}
              iconColor="text-violet-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Average Accepted Value"
              value={formatCurrency(summary.revenue.averageAcceptedValue)}
              icon={BarChart3}
              iconColor="text-amber-600"
            />
            <StatCard
              title="Open Pipeline (Draft + Sent)"
              value={formatCurrency(summary.revenue.openPipelineValue)}
              icon={FileText}
              iconColor="text-slate-500"
            />
            {/* Deliberately rendered as unavailable, never as 0 or an estimate. */}
            {unavailableByKey.has("averageSalesCycle") && (
              <UnavailableStat
                label={unavailableByKey.get("averageSalesCycle")!.label}
                reason={unavailableByKey.get("averageSalesCycle")!.reason}
              />
            )}
            {unavailableByKey.has("salesTarget") && (
              <UnavailableStat
                label={unavailableByKey.get("salesTarget")!.label}
                reason={unavailableByKey.get("salesTarget")!.reason}
              />
            )}
          </div>

          {/* Net vs gross, stated explicitly so the two are never conflated. */}
          <p className="text-xs text-muted-foreground">
            Net Accepted Revenue is the value of accepted quotations after discount and{" "}
            <span className="font-medium">excluding tax</span> (subtotal − discount). Gross Accepted
            Value is the full quotation total{" "}
            <span className="font-medium">including tax</span>. Draft and Sent quotations are
            reported as open pipeline and are never counted as revenue. Acceptance rate is measured
            over decided quotations only ({summary.quotationAcceptanceRate.accepted} accepted of{" "}
            {summary.quotationAcceptanceRate.decided} decided; draft and sent are excluded because
            they are still open).
          </p>

          {/* Controlled rather than uncontrolled so each Recharts container is
              mounted only while its own tab is visible. A chart rendered inside
              a hidden panel measures 0x0 and Recharts logs a "width(-1) and
              height(-1)" warning for it. */}
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="w-full">
            <div className="mb-6 inline-flex w-full rounded-xl bg-muted/50 p-1 sm:w-auto">
              <TabsList className="w-full border-none bg-transparent sm:w-auto">
                <TabsTrigger value="revenue" className="rounded-xl px-6 py-2.5">
                  Revenue
                </TabsTrigger>
                <TabsTrigger value="conversion" className="rounded-xl px-6 py-2.5">
                  Conversion
                </TabsTrigger>
                <TabsTrigger value="representatives" className="rounded-xl px-6 py-2.5">
                  Representatives
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ------------------------------------------------ Revenue tab */}
            <TabsContent value="revenue" className="mt-0 space-y-6">
              {!hasAnyRevenue ? (
                <EmptyState
                  icon={BadgeIndianRupee}
                  title="No accepted quotations yet"
                  description="Sales revenue is derived from quotations marked Accepted. Once a quotation is accepted, its value appears here."
                />
              ) : (
                <>
                  <Card className="rounded-xl shadow-sm">
                    <CardHeader>
                      <CardTitle>Revenue by month raised</CardTitle>
                      <CardDescription>
                        Net accepted revenue grouped by the month each quotation was raised. This is
                        not month-of-close — no acceptance date exists in the system.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {tab === "revenue" && byPeriod && byPeriod.buckets.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={byPeriod.buckets.map((bucket) => ({
                              name: format(new Date(bucket.periodStart), "MMM yyyy"),
                              net: bucket.netAcceptedRevenue,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                            />
                            <Tooltip
                              formatter={(value) =>
                                formatCurrency(typeof value === "number" ? value : Number(value ?? 0))
                              }
                              cursor={{ fill: "rgba(0,0,0,0.05)" }}
                            />
                            <Bar
                              dataKey="net"
                              name="Net accepted revenue"
                              fill="var(--chart-1)"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No accepted quotations in this period.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Top clients by revenue</CardTitle>
                        <CardDescription>Net accepted revenue per client.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {byClient.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No accepted quotations in this period.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="p-3 font-medium">Client</th>
                                  <th className="p-3 font-medium">Quotations</th>
                                  <th className="p-3 text-right font-medium">Net revenue</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {byClient.map((row) => (
                                  <tr key={row.clientId}>
                                    <td className="p-3 font-medium">{row.companyName}</td>
                                    <td className="p-3 text-muted-foreground">
                                      {row.acceptedQuotationCount}
                                    </td>
                                    <td className="p-3 text-right font-medium text-emerald-600">
                                      {formatCurrency(row.netAcceptedRevenue)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Top products by revenue</CardTitle>
                        <CardDescription>
                          Calculated from the historical price snapshot stored on each quotation
                          line, not the product&apos;s current catalogue price.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {byProduct.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No accepted quotation lines in this period.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="p-3 font-medium">Product</th>
                                  <th className="p-3 font-medium">Qty</th>
                                  <th className="p-3 text-right font-medium">Net revenue</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {byProduct.map((row) => (
                                  <tr key={row.productId ?? "ad-hoc"}>
                                    <td className="p-3 font-medium">
                                      {row.productName}
                                      {row.productId === null && (
                                        <Badge variant="outline" className="ml-2 text-[11px]">
                                          no catalogue product
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="p-3 text-muted-foreground">{row.quantity}</td>
                                    <td className="p-3 text-right font-medium text-emerald-600">
                                      {formatCurrency(row.netAcceptedRevenue)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Quotations by status</CardTitle>
                  <CardDescription>
                    Every quotation raised in this period, by its current status.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Count</th>
                          <th className="p-3 text-right font-medium">Net value</th>
                          <th className="p-3 text-right font-medium">Gross value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.quotationStatusBreakdown.map((bucket) => (
                          <tr key={bucket.status}>
                            <td className="p-3 font-medium capitalize">{bucket.status}</td>
                            <td className="p-3 text-muted-foreground">{bucket.count}</td>
                            <td className="p-3 text-right">{formatCurrency(bucket.netValue)}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(bucket.grossValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --------------------------------------------- Conversion tab */}
            <TabsContent value="conversion" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Enquiries Won" value={summary.enquiryConversion.won} icon={TrendingUp} iconColor="text-emerald-600" />
                <StatCard title="Enquiries Lost" value={summary.enquiryConversion.lost} icon={Ban} iconColor="text-red-600" />
                <StatCard
                  title="Enquiry Win Rate"
                  value={formatPercentage(summary.enquiryConversion.winRate)}
                  icon={Percent}
                  iconColor="text-indigo-600"
                />
                <StatCard
                  title="Won Enquiry Forecast"
                  value={formatCurrency(summary.enquiryConversion.wonExpectedRevenue)}
                  icon={Info}
                  iconColor="text-amber-600"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                &ldquo;Won Enquiry Forecast&rdquo; is the sum of the expected-revenue figure entered
                on each won enquiry. It is a forecast, not realized revenue, and is deliberately not
                combined with Net Accepted Revenue above.
              </p>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Enquiries by stage</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {tab === "conversion" && summary.enquiryConversion.total > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={summary.enquiryStageBreakdown.filter((b) => b.count > 0)}
                            dataKey="count"
                            nameKey="stage"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={4}
                          >
                            {summary.enquiryStageBreakdown
                              .filter((b) => b.count > 0)
                              .map((bucket, index) => (
                                <Cell
                                  key={bucket.stage}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No enquiries in this period.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Recently lost enquiries</CardTitle>
                    <CardDescription>
                      {unavailableByKey.get("lossReasonCategories")?.reason ??
                        "Lost reasons are free text and are shown exactly as recorded."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {lostEnquiries.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No lost enquiries in this period.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {lostEnquiries.map((enquiry) => (
                          <div key={enquiry.id} className="py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{enquiry.title}</p>
                                <p className="text-xs text-muted-foreground">{enquiry.clientName}</p>
                              </div>
                              <span className="shrink-0 text-sm text-muted-foreground">
                                {formatCurrency(enquiry.expectedRevenue)}
                              </span>
                            </div>
                            {enquiry.lostReason && (
                              <p className="mt-1 text-xs italic text-muted-foreground">
                                &ldquo;{enquiry.lostReason}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                        {lostTotal > lostEnquiries.length && (
                          <p className="pt-3 text-xs text-muted-foreground">
                            Showing {lostEnquiries.length} of {lostTotal} lost enquiries.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---------------------------------------- Representatives tab */}
            <TabsContent value="representatives" className="mt-0 space-y-6">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Revenue by representative</CardTitle>
                  <CardDescription>
                    {isSalesExec
                      ? "Your accepted-quotation revenue, from clients currently assigned to you."
                      : "Attributed to the user currently assigned to each accepted quotation. The system keeps no assignment history, so reassigning a quotation moves its revenue."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {byRep.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No accepted quotations yet"
                      description="Once quotations are accepted, revenue is attributed to their assigned representative here."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="p-3 font-medium">Representative</th>
                            <th className="p-3 font-medium">Accepted</th>
                            <th className="p-3 text-right font-medium">Net revenue</th>
                            <th className="p-3 text-right font-medium">Gross value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {byRep.map((row) => (
                            <tr key={row.userId ?? "unassigned"}>
                              <td className="p-3">
                                <p className="font-medium">{row.name}</p>
                                {row.email && (
                                  <p className="text-xs text-muted-foreground">{row.email}</p>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {row.acceptedQuotationCount}
                              </td>
                              <td className="p-3 text-right font-medium text-emerald-600">
                                {formatCurrency(row.netAcceptedRevenue)}
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                {formatCurrency(row.grossAcceptedValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Target/quota and ranking are not backed by any stored field. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {["salesTarget", "topPerformer", "representativeRole", "quotationTimeToAcceptance"]
                  .filter((key) => unavailableByKey.has(key))
                  .map((key) => (
                    <UnavailableStat
                      key={key}
                      label={unavailableByKey.get(key)!.label}
                      reason={unavailableByKey.get(key)!.reason}
                    />
                  ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* ------------------------------- Full unavailable-metric ledger */}
          <Card className="rounded-xl border-dashed shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Metrics not available in this system
              </CardTitle>
              <CardDescription>
                These are reported rather than estimated. Each one needs data the CRM does not
                currently record.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {summary.unavailableMetrics.map((metric) => (
                  <div key={metric.key} className="py-3">
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {metric.reason}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loadState === "loading" && <TableSkeleton rows={4} />}
    </motion.div>
  );
}
