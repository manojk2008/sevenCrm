"use client";

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Edit, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/shared/skeleton-loader';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Quotation, QuotationStatus } from '@/types/quotation';
import { getQuotation, getQuotationErrorMessage, updateQuotationStatus } from './api';

type LoadState = 'loading' | 'error' | 'not-found' | 'ready';

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-800 text-slate-100',
};

export function QuotationDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  // UX gating only — the backend (SUPER_ADMIN/ADMIN) remains the actual
  // authorization boundary, same convention as products-content.tsx.
  const canManage = currentUser?.role === 'super-admin' || currentUser?.role === 'admin';

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const loadQuotation = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await getQuotation(id);
      setQuotation(data);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }
        if (error.status === 404) {
          setLoadState('not-found');
          return;
        }
      }
      setLoadErrorMessage(getQuotationErrorMessage(error));
      setLoadState('error');
    }
  }, [id, handleUnauthorized]);

  useEffect(() => {
    Promise.resolve().then(loadQuotation);
  }, [loadQuotation]);

  const handleStatusChange = async (status: QuotationStatus) => {
    if (!quotation || status === quotation.status) return;
    setIsChangingStatus(true);
    try {
      const updated = await updateQuotationStatus(quotation.id, status);
      setQuotation(updated);
      toast.success(`Quotation marked as ${status}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getQuotationErrorMessage(error));
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (loadState === 'not-found') {
    return (
      <EmptyState
        icon={FileText}
        title="Quotation not found"
        description="This quotation doesn't exist, or you don't have access to it."
        actionLabel="Back to Quotations"
        onAction={() => router.push('/quotations')}
      />
    );
  }

  if (loadState === 'error' || !quotation) {
    return <ErrorState title="Couldn't load this quotation" description={loadErrorMessage} onRetry={loadQuotation} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Back to quotations" onClick={() => router.push('/quotations')} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{quotation.quotationNumber}</h1>
              <Badge className={`${STATUS_STYLES[quotation.status]} font-medium border-0 capitalize`}>
                {quotation.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{quotation.clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Select value={quotation.status} onValueChange={(v) => v && handleStatusChange(v as QuotationStatus)} disabled={isChangingStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Button onClick={() => router.push(`/quotations/builder?id=${quotation.id}`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="pb-2 text-left font-medium">Item</th>
                    <th className="pb-2 text-center font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Price</th>
                    <th className="pb-2 text-right font-medium">Disc %</th>
                    <th className="pb-2 text-right font-medium">Tax %</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotation.lineItems.map((line) => (
                    <tr key={line.id}>
                      <td className="py-3">
                        <p className="font-medium">{line.productName}</p>
                        {!line.productId && <p className="text-xs text-muted-foreground">Custom item</p>}
                        {line.description && <p className="text-xs text-muted-foreground mt-1">{line.description}</p>}
                      </td>
                      <td className="py-3 text-center">{line.quantity}</td>
                      <td className="py-3 text-right">{formatCurrency(line.unitPrice)}</td>
                      <td className="py-3 text-right">{line.discountPercentage}%</td>
                      <td className="py-3 text-right">{line.taxRate}%</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quotation.subtotal)}</span>
                </div>
                {quotation.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(quotation.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(quotation.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Grand Total</span>
                  <span>{formatCurrency(quotation.grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{quotation.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enquiry</span>
                <span className="font-medium">{quotation.enquiryTitle ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned to</span>
                <span className="font-medium">{quotation.assignedTo?.name ?? 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid until</span>
                <span className="font-medium">{format(new Date(quotation.validUntil), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{format(new Date(quotation.createdAt), 'dd MMM yyyy')}</span>
              </div>
            </CardContent>
          </Card>

          {(quotation.notes || quotation.terms) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes &amp; Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {quotation.notes && (
                  <div>
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <p className="text-muted-foreground mb-1">Terms &amp; Conditions</p>
                    <p className="whitespace-pre-wrap">{quotation.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
