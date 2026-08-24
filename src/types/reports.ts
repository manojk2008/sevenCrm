// Phase 8: Reports has no backend module of its own — every supported
// report type is composed entirely from the existing /sales/* (and, for the
// Monthly report, /dashboard/monthly-comparison) endpoints. This file only
// defines the report-type catalogue and which of them this phase actually
// implements for real.
export type ReportType =
  | "sales"
  | "revenue"
  | "executive"
  | "product"
  | "pipeline"
  | "conversion"
  | "monthly"
  | "client"
  | "follow-up";

/**
 * The 5 types approved for real implementation (Phase 8 decision D2), plus
 * "conversion" and "monthly" — both implemented for real too, since they
 * turned out to need zero new backend work: conversion reuses Sales's
 * existing enquiryConversion/quotationAcceptanceRate figures, and monthly
 * reuses the same /dashboard/monthly-comparison endpoint the Dashboard
 * widget uses. "client" (acquisition trend) and "follow-up" (completion
 * rate) are NOT in this list — implementing either honestly would require a
 * new aggregation this phase did not build, so they render an explicit
 * "not available" state instead of a fabricated chart.
 */
export const SUPPORTED_REPORT_TYPES: ReportType[] = [
  "sales",
  "revenue",
  "executive",
  "product",
  "pipeline",
  "conversion",
  "monthly",
];

export interface ReportMeta {
  id: ReportType;
  title: string;
  description: string;
}

/** A single row for CSV export — every report renders its table through this so export always matches what's on screen. */
export type CsvRow = Record<string, string | number>;
