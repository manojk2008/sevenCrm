"use client";

/**
 * Reports — every supported type is real data composed from /sales/* and
 * /dashboard/monthly-comparison (see ./api.ts). There is no backend module
 * for Reports itself and no report type here recomputes a figure Sales
 * already owns (Phase 8 decision D6).
 *
 * "client" (acquisition trend) and "follow-up" (completion rate) are NOT
 * implemented — building either honestly would need a new aggregation this
 * phase did not build — so they render an explicit "not available" state
 * rather than a fabricated chart (see SUPPORTED_REPORT_TYPES in
 * src/types/reports.ts for the full reasoning).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, Ban, Download, Info } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { ChartSkeleton, TableSkeleton } from "@/components/shared/skeleton-loader";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/format";
import { SUPPORTED_REPORT_TYPES, type CsvRow, type ReportType } from "@/types/reports";
import {
  downloadCsv,
  getConversionReportData,
  getExecutiveReportData,
  getMonthlyReportData,
  getPipelineReportData,
  getProductReportData,
  getReportErrorMessage,
  getRevenueReportData,
  getSalesReportData,
  type ConversionReportData,
  type ExecutiveReportData,
  type MonthlyReportData,
  type PipelineReportData,
  type ProductReportData,
  type RevenueReportData,
  type SalesReportData,
} from "./api";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ReportData =
  | { kind: "sales"; data: SalesReportData }
  | { kind: "revenue"; data: RevenueReportData }
  | { kind: "executive"; data: ExecutiveReportData }
  | { kind: "product"; data: ProductReportData }
  | { kind: "pipeline"; data: PipelineReportData }
  | { kind: "conversion"; data: ConversionReportData }
  | { kind: "monthly"; data: MonthlyReportData };

interface ReportViewerProps {
  type: string;
}

function getReportTitle(type: string): string {
  return (
    type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") + " Report"
  );
}

function NotAvailableReport({ type }: { type: string }) {
  const reasons: Record<string, string> = {
    client:
      "A new-clients-over-time trend needs a Clients-by-month aggregation that was not built in this phase.",
    "follow-up":
      "A completion-rate analysis needs further follow-up outcome aggregation that was not built in this phase.",
  };
  return (
    <Card className="rounded-xl border-dashed shadow-none bg-muted/30">
      <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
        <Ban className="h-8 w-8 text-muted-foreground/60" />
        <h3 className="text-lg font-semibold text-muted-foreground">Not available</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {reasons[type] ??
            "This report is not implemented in this phase and no fabricated figures are shown in its place."}
        </p>
      </CardContent>
    </Card>
  );
}

export function ReportViewer({ type }: ReportViewerProps) {
  const reportType = type as ReportType;
  const isSupported = SUPPORTED_REPORT_TYPES.includes(reportType);

  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    isSupported ? "loading" : "ready",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const params = useMemo(
    () => ({ from: date?.from?.toISOString(), to: date?.to?.toISOString() }),
    [date?.from, date?.to],
  );

  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      try {
        let next: ReportData;
        switch (reportType) {
          case "sales":
            next = { kind: "sales", data: await getSalesReportData(params) };
            break;
          case "revenue":
            next = { kind: "revenue", data: await getRevenueReportData(params) };
            break;
          case "executive":
            next = { kind: "executive", data: await getExecutiveReportData(params) };
            break;
          case "product":
            next = { kind: "product", data: await getProductReportData(params) };
            break;
          case "pipeline":
            next = { kind: "pipeline", data: await getPipelineReportData(params) };
            break;
          case "conversion":
            next = { kind: "conversion", data: await getConversionReportData(params) };
            break;
          case "monthly":
            next = { kind: "monthly", data: await getMonthlyReportData() };
            break;
          default:
            return;
        }
        if (cancelled) return;
        setReportData(next);
        setErrorMessage("");
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(getReportErrorMessage(error));
        setLoadState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, params.from, params.to]);

  const csvRows = useMemo<CsvRow[]>(() => toCsvRows(reportData), [reportData]);

  const handleExportCsv = () => {
    downloadCsv(`${type}-report`, csvRows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/reports"
            aria-label="Back to reports"
            className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-background transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{getReportTitle(type)}</h2>
            <CardDescription>
              {isSupported ? "Real figures from accepted quotations and enquiries." : "Detailed analysis and insights"}
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSupported && <DatePickerWithRange date={date} setDate={setDate} />}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!isSupported || csvRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled title="Excel export is not available in this phase.">
            Excel (unavailable)
          </Button>
        </div>
      </div>

      {isSupported && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Figures are filtered by the date each quotation or enquiry was <em>raised</em>, not when
            it was accepted, succeeded, or closed — the database records no such timestamp.
          </p>
        </div>
      )}

      {!isSupported && <NotAvailableReport type={reportType} />}

      {isSupported && loadState === "loading" && (
        <div className="space-y-6">
          <ChartSkeleton />
          <TableSkeleton rows={5} />
        </div>
      )}

      {isSupported && loadState === "error" && (
        <Card className="rounded-xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{errorMessage}</CardContent>
        </Card>
      )}

      {isSupported && loadState === "ready" && reportData && <ReportBody reportData={reportData} />}
    </div>
  );
}

function ReportBody({ reportData }: { reportData: ReportData }) {
  switch (reportData.kind) {
    case "sales":
      return <SalesReport data={reportData.data} />;
    case "revenue":
      return <RevenueReport data={reportData.data} />;
    case "executive":
      return <ExecutiveReport data={reportData.data} />;
    case "product":
      return <ProductReport data={reportData.data} />;
    case "pipeline":
      return <PipelineReport data={reportData.data} />;
    case "conversion":
      return <ConversionReport data={reportData.data} />;
    case "monthly":
      return <MonthlyReport data={reportData.data} />;
  }
}

// --------------------------------------------------------------- Sales

function SalesReport({ data }: { data: SalesReportData }) {
  const { summary, byPeriod } = data;
  const chartData = byPeriod.buckets.map((b) => ({
    name: format(new Date(b.periodStart), "MMM yyyy"),
    revenue: b.netAcceptedRevenue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile title="Net Accepted Revenue" value={formatCurrency(summary.revenue.netAcceptedRevenue)} />
        <StatTile title="Avg Accepted Value" value={formatCurrency(summary.revenue.averageAcceptedValue)} />
        <StatTile title="Accepted Quotations" value={formatNumber(summary.revenue.acceptedQuotationCount)} />
        <StatTile title="Acceptance Rate" value={formatPercentage(summary.quotationAcceptanceRate.rate)} />
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Net Revenue by Month Raised</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 100000}L`} />
                  <RechartsTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                    formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Quotations by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
                <TableHead className="text-right">Gross Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.quotationStatusBreakdown.map((row) => (
                <TableRow key={row.status}>
                  <TableCell className="font-medium capitalize">{row.status}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.netValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.grossValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------- Revenue

function RevenueReport({ data }: { data: RevenueReportData }) {
  const { byPeriod, byClient, byProduct } = data;
  const chartData = byPeriod.buckets.map((b) => ({
    name: format(new Date(b.periodStart), "MMM yyyy"),
    revenue: b.netAcceptedRevenue,
  }));

  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Net Accepted Revenue by Month Raised</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis tickFormatter={(v) => `₹${v / 100000}L`} stroke="var(--muted-foreground)" fontSize={12} />
                  <RechartsTooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
                  <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Top Clients by Net Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={byClient.map((c) => ({ name: c.companyName, value: c.netAcceptedRevenue }))} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `₹${v / 100000}L`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Revenue by Product</CardTitle>
            <CardDescription>Historical price snapshots, not current catalogue price.</CardDescription>
          </CardHeader>
          <CardContent>
            {byProduct.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byProduct.map((p) => ({ name: p.productName, value: p.netAcceptedRevenue }))} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {byProduct.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- Executive

function ExecutiveReport({ data }: { data: ExecutiveReportData }) {
  const { byRepresentative } = data;
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {byRepresentative.slice(0, 4).map((rep, i) => (
          <Card key={rep.userId ?? "unassigned"} className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{rep.name}</h3>
                  <p className="text-sm text-muted-foreground">{rep.acceptedQuotationCount} accepted</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {i + 1}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold">{formatCurrency(rep.netAcceptedRevenue)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Revenue by Representative</CardTitle>
        </CardHeader>
        <CardContent>
          {byRepresentative.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRepresentative.map((r) => ({ name: r.name, revenue: r.netAcceptedRevenue, accepted: r.acceptedQuotationCount }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `₹${v / 100000}L`} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Net Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="accepted" name="Accepted Count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------- Product

function ProductReport({ data }: { data: ProductReportData }) {
  const { byProduct } = data;
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Revenue by Product</CardTitle>
        <CardDescription>Historical price snapshots, not current catalogue price. Ad-hoc lines have no catalogue product.</CardDescription>
      </CardHeader>
      <CardContent>
        {byProduct.length === 0 ? (
          <EmptyChart />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Net Revenue</TableHead>
                <TableHead className="text-right">Gross Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProduct.map((row) => (
                <TableRow key={row.productId ?? "ad-hoc"}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.netAcceptedRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.grossAcceptedValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------- Pipeline

function PipelineReport({ data }: { data: PipelineReportData }) {
  const { summary } = data;
  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Enquiries by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Expected Revenue (forecast)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.enquiryStageBreakdown.map((row) => (
                <TableRow key={row.stage}>
                  <TableCell className="font-medium capitalize">{row.stage.replace("-", " ")}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.expectedRevenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Quotations by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.quotationStatusBreakdown.map((row) => (
                <TableRow key={row.status}>
                  <TableCell className="font-medium capitalize">{row.status}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.netValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------- Conversion

function ConversionReport({ data }: { data: ConversionReportData }) {
  const { summary } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile title="Enquiries Succeeded" value={formatNumber(summary.enquiryConversion.won)} />
        <StatTile title="Enquiries Failed" value={formatNumber(summary.enquiryConversion.lost)} />
        <StatTile title="Enquiry Success Rate" value={formatPercentage(summary.enquiryConversion.winRate)} />
        <StatTile title="Quotation Acceptance Rate" value={formatPercentage(summary.quotationAcceptanceRate.rate)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Success rate is succeeded ÷ (succeeded + failed); open enquiries are excluded. Acceptance
        rate is accepted ÷ decided quotations (draft/sent are still open and excluded).
      </p>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Enquiries by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.enquiryConversion.total === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.enquiryStageBreakdown.filter((b) => b.count > 0)}
                    dataKey="count"
                    nameKey="stage"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                  >
                    {summary.enquiryStageBreakdown
                      .filter((b) => b.count > 0)
                      .map((b, index) => (
                        <Cell key={b.stage} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------- Monthly

function MonthlyReport({ data }: { data: MonthlyReportData }) {
  const { comparison } = data;
  const rows = [
    { name: "Leads", current: comparison.current.leads, previous: comparison.previous.leads },
    { name: "Meetings", current: comparison.current.meetings, previous: comparison.previous.meetings },
    { name: "Quotes", current: comparison.current.quotes, previous: comparison.previous.quotes },
    { name: "Wins", current: comparison.current.wins, previous: comparison.previous.wins },
  ];
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        This report always compares the current calendar month to the previous one — the date range
        picker above does not apply to it.
      </p>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>This Month vs Last Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="previous" name="Last Month" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="current" name="This Month" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------- shared UI

function StatTile({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      No data for this period.
    </div>
  );
}

function toCsvRows(reportData: ReportData | null): CsvRow[] {
  if (!reportData) return [];
  switch (reportData.kind) {
    case "sales":
      return reportData.data.summary.quotationStatusBreakdown.map((r) => ({
        Status: r.status,
        Count: r.count,
        "Net Value": r.netValue,
        "Gross Value": r.grossValue,
      }));
    case "revenue":
      return reportData.data.byClient.map((r) => ({
        Client: r.companyName,
        "Accepted Quotations": r.acceptedQuotationCount,
        "Net Revenue": r.netAcceptedRevenue,
        "Gross Revenue": r.grossAcceptedValue,
      }));
    case "executive":
      return reportData.data.byRepresentative.map((r) => ({
        Representative: r.name,
        Email: r.email ?? "",
        "Accepted Quotations": r.acceptedQuotationCount,
        "Net Revenue": r.netAcceptedRevenue,
        "Gross Revenue": r.grossAcceptedValue,
      }));
    case "product":
      return reportData.data.byProduct.map((r) => ({
        Product: r.productName,
        Quantity: r.quantity,
        "Net Revenue": r.netAcceptedRevenue,
        "Gross Revenue": r.grossAcceptedValue,
      }));
    case "pipeline":
      return reportData.data.summary.enquiryStageBreakdown.map((r) => ({
        Stage: r.stage,
        Count: r.count,
        "Expected Revenue": r.expectedRevenue,
      }));
    case "conversion":
      return reportData.data.summary.enquiryStageBreakdown.map((r) => ({
        Stage: r.stage,
        Count: r.count,
      }));
    case "monthly":
      return [
        { Metric: "Leads", "This Month": reportData.data.comparison.current.leads, "Last Month": reportData.data.comparison.previous.leads },
        { Metric: "Meetings", "This Month": reportData.data.comparison.current.meetings, "Last Month": reportData.data.comparison.previous.meetings },
        { Metric: "Quotes", "This Month": reportData.data.comparison.current.quotes, "Last Month": reportData.data.comparison.previous.quotes },
        { Metric: "Wins", "This Month": reportData.data.comparison.current.wins, "Last Month": reportData.data.comparison.previous.wins },
      ];
  }
}
