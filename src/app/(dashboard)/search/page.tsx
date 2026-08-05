import { Suspense } from "react";
import { SearchContent } from "@/features/search/search-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "Search across all modules",
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
