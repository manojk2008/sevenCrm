"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Building2,
  Package,
  TrendingUp,
  Users,
  FileText,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "clients" | "products" | "enquiries" | "users" | "quotations";
  href: string;
  meta?: string;
}

const ALL_RESULTS: SearchResult[] = [
  { id: "1", title: "Tata Consultancy Services", subtitle: "Information Technology", category: "clients", href: "/clients/CL001", meta: "₹2,45,00,000 revenue" },
  { id: "2", title: "Infosys Limited", subtitle: "Information Technology", category: "clients", href: "/clients/CL002", meta: "₹1,85,00,000 revenue" },
  { id: "3", title: "Wipro Technologies", subtitle: "Information Technology", category: "clients", href: "/clients/CL003", meta: "₹1,20,00,000 revenue" },
  { id: "4", title: "Reliance Industries", subtitle: "Manufacturing", category: "clients", href: "/clients/CL004", meta: "₹3,50,00,000 revenue" },
  { id: "5", title: "HDFC Bank", subtitle: "Finance & Banking", category: "clients", href: "/clients/CL005", meta: "₹90,00,000 revenue" },
  { id: "6", title: "Bajaj Auto", subtitle: "Automobile", category: "clients", href: "/clients/CL006", meta: "₹75,00,000 revenue" },
  { id: "7", title: "HCL Technologies", subtitle: "Information Technology", category: "clients", href: "/clients/CL007" },
  { id: "8", title: "Mahindra & Mahindra", subtitle: "Automobile", category: "clients", href: "/clients/CL008" },
  { id: "10", title: "Enterprise ERP Suite", subtitle: "Software Solutions — ₹15,00,000", category: "products", href: "/products" },
  { id: "11", title: "Cloud Hosting Plan", subtitle: "Cloud Services — ₹45,000/mo", category: "products", href: "/products" },
  { id: "12", title: "Cybersecurity Audit", subtitle: "Security — ₹3,50,000", category: "products", href: "/products" },
  { id: "13", title: "AI Analytics Platform", subtitle: "AI & ML Services — ₹25,00,000", category: "products", href: "/products" },
  { id: "14", title: "Data Migration Service", subtitle: "Custom Development — ₹5,00,000", category: "products", href: "/products" },
  { id: "20", title: "ERP Implementation for TCS", subtitle: "Quotation Sent — ₹45,00,000", category: "enquiries", href: "/enquiries", meta: "85% probability" },
  { id: "21", title: "Cloud Migration for Infosys", subtitle: "Negotiation — ₹32,00,000", category: "enquiries", href: "/enquiries", meta: "70% probability" },
  { id: "22", title: "Security Audit for HDFC", subtitle: "New — ₹8,50,000", category: "enquiries", href: "/enquiries" },
  { id: "23", title: "Custom Dev for Reliance", subtitle: "Follow-up — ₹65,00,000", category: "enquiries", href: "/enquiries" },
  { id: "30", title: "Rajesh Kumar", subtitle: "Super Admin — rajesh@sevencrm.in", category: "users", href: "/users" },
  { id: "31", title: "Priya Sharma", subtitle: "Admin — priya@sevencrm.in", category: "users", href: "/users" },
  { id: "32", title: "Amit Patel", subtitle: "Sales Manager — amit@sevencrm.in", category: "users", href: "/users" },
  { id: "33", title: "Vikram Singh", subtitle: "Sales Executive — vikram@sevencrm.in", category: "users", href: "/users" },
  { id: "40", title: "QT-2024-0001", subtitle: "Tata Consultancy Services — ₹53,10,000", category: "quotations", href: "/quotations" },
  { id: "41", title: "QT-2024-0002", subtitle: "Infosys — ₹37,76,000", category: "quotations", href: "/quotations" },
  { id: "42", title: "QT-2024-0003", subtitle: "Wipro — ₹14,16,000", category: "quotations", href: "/quotations" },
];

const CATEGORY_CONFIG = {
  clients: { icon: Building2, label: "Clients", color: "text-blue-500" },
  products: { icon: Package, label: "Products", color: "text-violet-500" },
  enquiries: { icon: TrendingUp, label: "Enquiries", color: "text-amber-500" },
  users: { icon: Users, label: "Users", color: "text-emerald-500" },
  quotations: { icon: FileText, label: "Quotations", color: "text-rose-500" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all");

  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_RESULTS;
    return ALL_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        (r.meta && r.meta.toLowerCase().includes(q))
    );
  }, [query]);

  const resultsByCategory = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    filteredResults.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [filteredResults]);

  const displayResults =
    activeTab === "all"
      ? filteredResults
      : filteredResults.filter((r) => r.category === activeTab);

  return (
    <div className="section-gap">
      <div className="max-w-4xl mx-auto">
        {/* Search Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="mb-4 text-3xl font-bold tracking-tight">Search Results</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, products, enquiries, users, quotations..."
              className="pl-12 h-12 text-base rounded-xl"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Badge variant="outline" className="text-xs">
                {displayResults.length} results
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">
              All ({filteredResults.length})
            </TabsTrigger>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const count = resultsByCategory[key]?.length ?? 0;
              if (count === 0) return null;
              return (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  <config.icon className="size-3.5" />
                  {config.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Results */}
        {displayResults.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Filter className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No results found</h3>
            <p className="text-muted-foreground text-sm">
              Try adjusting your search query or filters
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {displayResults.map((result) => {
              const config = CATEGORY_CONFIG[result.category];
              const Icon = config.icon;
              return (
                <motion.div key={result.id} variants={itemVariants}>
                  <Link href={result.href}>
                    <Card className="rounded-xl hover:shadow-card transition-[box-shadow,border-color] duration-200 hover:border-primary/20 group cursor-pointer">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className={`size-10 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
                          <Icon className={`size-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{result.title}</p>
                            <Badge variant="outline" className="text-[11px] shrink-0">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        </div>
                        {result.meta && (
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {result.meta}
                          </span>
                        )}
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
