/**
 * Data layer for the Reports feature.
 *
 * Reports has NO backend module of its own. Every supported report type is
 * composed here purely from the existing, already-authoritative endpoints —
 * Sales for anything revenue/acceptance/conversion-shaped, Dashboard for the
 * Monthly report's leads/meetings/quotes/wins comparison — never a second
 * implementation of a figure those modules already own (Phase 8 decision
 * D6). This file's job is only to fetch-and-shape per report type, and to
 * turn whatever table is on screen into a real CSV file.
 */
import {
  getSalesSummary,
  getRevenueByPeriod,
  getRevenueByClient,
  getRevenueByProduct,
  getRevenueByRepresentative,
  getSalesErrorMessage,
} from "@/features/sales/api";
import { getMonthlyComparison } from "@/features/dashboard/api";
import type {
  RevenueByClient,
  RevenueByPeriod,
  RevenueByProduct,
  RevenueByRepresentative,
  SalesSummary,
} from "@/types/sales";
import type { MonthlyComparison } from "@/types/dashboard";
import type { CsvRow } from "@/types/reports";

export const getReportErrorMessage = getSalesErrorMessage;

export interface ReportPeriodParams {
  from?: string;
  to?: string;
}

export interface SalesReportData {
  summary: SalesSummary;
  byPeriod: RevenueByPeriod;
}

export async function getSalesReportData(params: ReportPeriodParams = {}): Promise<SalesReportData> {
  const [summary, byPeriod] = await Promise.all([
    getSalesSummary(params),
    getRevenueByPeriod(params),
  ]);
  return { summary, byPeriod };
}

export interface RevenueReportData {
  byPeriod: RevenueByPeriod;
  byClient: RevenueByClient[];
  byProduct: RevenueByProduct[];
}

export async function getRevenueReportData(
  params: ReportPeriodParams = {},
): Promise<RevenueReportData> {
  const [byPeriod, byClient, byProduct] = await Promise.all([
    getRevenueByPeriod(params),
    getRevenueByClient({ ...params, limit: 10 }),
    getRevenueByProduct({ ...params, limit: 10 }),
  ]);
  return { byPeriod, byClient, byProduct };
}

export interface ExecutiveReportData {
  byRepresentative: RevenueByRepresentative[];
}

export async function getExecutiveReportData(
  params: ReportPeriodParams = {},
): Promise<ExecutiveReportData> {
  const byRepresentative = await getRevenueByRepresentative({ ...params, limit: 25 });
  return { byRepresentative };
}

export interface ProductReportData {
  byProduct: RevenueByProduct[];
}

export async function getProductReportData(
  params: ReportPeriodParams = {},
): Promise<ProductReportData> {
  const byProduct = await getRevenueByProduct({ ...params, limit: 25 });
  return { byProduct };
}

export interface PipelineReportData {
  summary: SalesSummary;
}

export async function getPipelineReportData(
  params: ReportPeriodParams = {},
): Promise<PipelineReportData> {
  const summary = await getSalesSummary(params);
  return { summary };
}

export interface ConversionReportData {
  summary: SalesSummary;
}

export async function getConversionReportData(
  params: ReportPeriodParams = {},
): Promise<ConversionReportData> {
  const summary = await getSalesSummary(params);
  return { summary };
}

export interface MonthlyReportData {
  comparison: MonthlyComparison;
}

export async function getMonthlyReportData(): Promise<MonthlyReportData> {
  const comparison = await getMonthlyComparison();
  return { comparison };
}

// ---------------------------------------------------------------------------
// Real CSV export (Phase 8 decision D5). No XLSX dependency, no fake Excel
// download — Excel is presented as unavailable in the UI instead.
// ---------------------------------------------------------------------------

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds an actual CSV file from the rows currently on screen and triggers a browser download. Nothing is fetched again — this is exactly what the caller passes in. */
export function downloadCsv(filename: string, rows: CsvRow[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
