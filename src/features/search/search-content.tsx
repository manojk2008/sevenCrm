"use client";

/**
 * Search — a real, organization-scoped composed search over Client /
 * Enquiry / Product / Quotation (see backend/src/search). Every result is a
 * real record; every href is a route that actually exists. Users are
 * deliberately not searched (Phase 10 approved scope).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search as SearchIcon,
  Building2,
  Package,
  TrendingUp,
  FileText,
  ArrowRight,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { search as searchApi, getSearchErrorMessage } from "./api";
import type { SearchResult, SearchResultType } from "@/types/search";

const CATEGORY_CONFIG: Record<
  SearchResultType,
  { icon: LucideIcon; label: string; singularLabel: string; color: string }
> = {
  client: { icon: Building2, label: "Clients", singularLabel: "Client", color: "text-blue-500" },
  enquiry: { icon: TrendingUp, label: "Enquiries", singularLabel: "Enquiry", color: "text-amber-500" },
  product: { icon: Package, label: "Products", singularLabel: "Product", color: "text-violet-500" },
  quotation: { icon: FileText, label: "Quotations", singularLabel: "Quotation", color: "text-rose-500" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

type LoadState = "idle" | "loading" | "error" | "ready";

export function SearchContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const debouncedQuery = useDebounce(query, 300);
  const trimmedQuery = debouncedQuery.trim();

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const runSearch = useCallback(
    async (q: string) => {
      setLoadState("loading");
      try {
        const response = await searchApi(q);
        setResults(response.results);
        setErrorMessage("");
        setLoadState("ready");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }
        setErrorMessage(getSearchErrorMessage(error));
        setLoadState("error");
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    // An empty query needs no request — `phase` below already renders the
    // idle state whenever trimmedQuery is empty, regardless of whatever
    // `loadState`/`results` were left over from a prior, non-empty search,
    // so there's nothing to reset here.
    if (!trimmedQuery) return;
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously within the effect body (same pattern used by
    // src/features/notifications/notifications-content.tsx for the same
    // lint rule).
    Promise.resolve().then(() => runSearch(trimmedQuery));
  }, [trimmedQuery, runSearch]);

  // Derived rather than stored: an empty query is always "idle" for
  // rendering purposes, even if `loadState` still holds the outcome of the
  // last non-empty search.
  const phase: LoadState = trimmedQuery ? loadState : "idle";

  const resultsByCategory = useMemo(() => {
    const groups: Partial<Record<SearchResultType, SearchResult[]>> = {};
    for (const r of results) {
      (groups[r.type] ??= []).push(r);
    }
    return groups;
  }, [results]);

  const displayResults =
    activeTab === "all" ? results : results.filter((r) => r.type === (activeTab as SearchResultType));

  return (
    <div className="section-gap">
      <div className="max-w-4xl mx-auto">
        {/* Search Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="mb-4 text-3xl font-bold tracking-tight">Search</h1>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, enquiries, products, quotations..."
              className="pl-12 h-12 text-base rounded-xl"
              autoFocus
            />
            {phase === "ready" && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Badge variant="outline" className="text-xs">
                  {results.length} {results.length === 1 ? "result" : "results"}
                </Badge>
              </div>
            )}
          </div>
        </motion.div>

        {/* Initial state — nothing searched yet, no backend call made. */}
        {phase === "idle" && (
          <EmptyState
            icon={SearchIcon}
            title="Search your CRM"
            description="Start typing to search clients, enquiries, products, and quotations."
          />
        )}

        {phase === "loading" && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        )}

        {phase === "error" && (
          <ErrorState
            title="Couldn't search"
            description="We couldn't reach the search service."
            showDetails
            errorMessage={errorMessage}
            onRetry={() => void runSearch(trimmedQuery)}
          />
        )}

        {phase === "ready" && (
          <>
            {/* Category Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all">All ({results.length})</TabsTrigger>
                {(Object.entries(CATEGORY_CONFIG) as [SearchResultType, (typeof CATEGORY_CONFIG)[SearchResultType]][]).map(
                  ([key, config]) => {
                    const count = resultsByCategory[key]?.length ?? 0;
                    if (count === 0) return null;
                    return (
                      <TabsTrigger key={key} value={key} className="gap-1.5">
                        <config.icon className="size-3.5" />
                        {config.label} ({count})
                      </TabsTrigger>
                    );
                  },
                )}
              </TabsList>
            </Tabs>

            {/* Results */}
            {displayResults.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <Filter className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-1">No results found</h3>
                <p className="text-muted-foreground text-sm">
                  Try a different search term.
                </p>
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {displayResults.map((result) => {
                  const config = CATEGORY_CONFIG[result.type];
                  const Icon = config.icon;
                  return (
                    <motion.div key={`${result.type}:${result.id}`} variants={itemVariants}>
                      <Link href={result.href}>
                        <Card className="rounded-xl hover:shadow-card transition-[box-shadow,border-color] duration-200 hover:border-primary/20 group cursor-pointer">
                          <CardContent className="flex items-center gap-4 p-4">
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Icon className={`size-5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{result.title}</p>
                                <Badge variant="outline" className="text-[11px] shrink-0">
                                  {config.singularLabel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {result.description}
                              </p>
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
