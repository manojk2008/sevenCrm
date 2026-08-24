"use client";

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Eye, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableSkeleton } from '@/components/shared/skeleton-loader';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Quotation, QuotationStatus } from '@/types/quotation';
import { listQuotations, getQuotationErrorMessage, type ListQuotationsParams } from './api';

type LoadState = 'loading' | 'error' | 'ready';

const PAGE_SIZE = 10;

const StatusBadge = ({ status }: { status: QuotationStatus }) => {
  const styles: Record<QuotationStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    accepted: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    rejected: 'bg-red-100 text-red-700 hover:bg-red-200',
    expired: 'bg-slate-800 text-slate-100',
  };
  return <Badge className={`${styles[status]} font-medium border-0 capitalize`}>{status}</Badge>;
};

export function QuotationsContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  // UX gating only — the backend (SUPER_ADMIN/ADMIN on every write) remains
  // the actual authorization boundary, same convention products-content.tsx
  // uses. src/constants/roles.ts is not authoritative and is not consulted.
  const canManage = currentUser?.role === 'super-admin' || currentUser?.role === 'admin';

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all');

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const loadQuotations = useCallback(async () => {
    setLoadState('loading');
    try {
      const params: ListQuotationsParams = { search, status: statusFilter, page, pageSize: PAGE_SIZE };
      const result = await listQuotations(params);
      setQuotations(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getQuotationErrorMessage(error));
      setLoadState('error');
    }
  }, [search, statusFilter, page, handleUnauthorized]);

  useEffect(() => {
    Promise.resolve().then(loadQuotations);
  }, [loadQuotations]);

  // Debounce free-text search before it drives a request; resets to page 1
  // in the same tick rather than a separate reactive effect (mirrors
  // enquiries-content.tsx's combined search/page-reset debounce).
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const isFiltered = !!search || statusFilter !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground mt-1">Create and manage professional quotations</p>
        </div>
        {canManage && (
          <Button onClick={() => router.push('/quotations/builder')} className="rounded-xl shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Create Quotation
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by quotation number or client..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9 rounded-xl bg-slate-50 dark:bg-slate-950"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (!value) return;
            setStatusFilter(value as QuotationStatus | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px] rounded-xl bg-slate-50 dark:bg-slate-950">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadState === 'loading' && <TableSkeleton rows={PAGE_SIZE} />}

      {loadState === 'error' && (
        <ErrorState
          title="Couldn't load quotations"
          description={loadErrorMessage}
          onRetry={loadQuotations}
        />
      )}

      {loadState === 'ready' && quotations.length === 0 && (
        <EmptyState
          icon={FileText}
          title={isFiltered ? 'No quotations found' : 'No quotations yet'}
          description={
            isFiltered
              ? "We couldn't find any quotations matching your criteria."
              : canManage
                ? 'Create your first quotation to send to a client.'
                : 'No quotations have been created yet.'
          }
          actionLabel={canManage && !isFiltered ? 'Create Quotation' : undefined}
          onAction={canManage && !isFiltered ? () => router.push('/quotations/builder') : undefined}
        />
      )}

      {loadState === 'ready' && quotations.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Quotation #</th>
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium">Valid Until</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {quotations.map(quotation => (
                  <tr key={quotation.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">
                      <button onClick={() => router.push(`/quotations/${quotation.id}`)} className="hover:underline">
                        {quotation.quotationNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium">{quotation.clientName}</td>
                    <td className="px-6 py-4">{formatCurrency(quotation.grandTotal)}</td>
                    <td className="px-6 py-4"><StatusBadge status={quotation.status} /></td>
                    <td className="px-6 py-4 text-slate-500">{format(new Date(quotation.createdAt), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-4 text-slate-500">{format(new Date(quotation.validUntil), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              className="h-8 w-8 rounded-lg p-0"
                              aria-label={`Actions for quotation ${quotation.quotationNumber}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/quotations/${quotation.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={() => router.push(`/quotations/builder?id=${quotation.id}`)}>
                              <FileText className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Showing {quotations.length} of {total} results
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
