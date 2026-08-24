// Phase 10: Search is a read-only composed view over Client / Enquiry /
// Product / Quotation — see backend/src/search/search.service.ts. The
// backend's type/field names already use this codebase's lowercase
// convention, so no enum-translation table is needed in this file's api.ts
// (unlike EnquiryStage/QuotationStatus elsewhere).
export type SearchResultType = "client" | "enquiry" | "product" | "quotation";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  /** A real, existing route. Never a fabricated destination. */
  href: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}
