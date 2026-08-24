"use client";

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Eye, FileText, Send, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { QuotationPreview } from './quotation-preview';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { listClients } from '@/features/clients/api';
import { listEnquiries } from '@/features/enquiries/api';
import { listProducts } from '@/features/products/api';
import { listUsers } from '@/features/users/api';
import {
  createQuotation,
  getQuotation,
  getQuotationErrorMessage,
  updateQuotation,
  type QuotationLineItemInput,
} from './api';

const CUSTOM_PRODUCT = '__custom__';

interface SelectOption {
  id: string;
  label: string;
}

interface ProductOption extends SelectOption {
  price: number;
}

/**
 * One line item as the builder edits it.
 *
 * `originalProductId` and `id` together are what let a saved line's
 * historical snapshot survive an unrelated edit: when `id` is set and the
 * user hasn't changed `productId` away from `originalProductId`,
 * `productName`/`unitPrice` here are the SNAPSHOT loaded from the backend
 * (getQuotation), not a live catalog lookup — they are sent back verbatim
 * and the backend preserves them untouched (see api.ts's
 * QuotationLineItemInput doc comment). Only when the user actually adds a
 * new row or swaps the product on an existing row does this component
 * preview the *live* catalog price/name, because that is what will actually
 * be snapshotted on save.
 */
interface BuilderLineItem {
  key: string;
  id?: string;
  originalProductId: string | null;
  productId: string | null;
  productName: string;
  unitPrice: number;
  description: string;
  quantity: number;
  discountPercentage: number;
  taxRate: number;
}

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

function emptyLine(): BuilderLineItem {
  return {
    key: nextKey(),
    originalProductId: null,
    productId: null,
    productName: '',
    unitPrice: 0,
    description: '',
    quantity: 1,
    discountPercentage: 0,
    taxRate: 0,
  };
}

function calculateRowTotal(line: BuilderLineItem) {
  const base = line.quantity * line.unitPrice;
  const afterDiscount = base - base * (line.discountPercentage / 100);
  return afterDiscount + afterDiscount * (line.taxRate / 100);
}

function toDateInputValue(iso: string | Date | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function QuotationBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingId = searchParams.get('id') ?? undefined;
  const isEdit = !!editingId;

  const logout = useAuthStore((state) => state.logout);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [enquiryId, setEnquiryId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    `1. Payment terms: 50% advance, balance on delivery.
2. Quotation valid for 15 days from the date of issue.
3. Any additional requirements will be billed separately.
4. Annual maintenance charges are subject to revision.`,
  );
  const [items, setItems] = useState<BuilderLineItem[]>([emptyLine()]);
  const [quotationNumber, setQuotationNumber] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [clients, setClients] = useState<SelectOption[]>([]);
  const [enquiries, setEnquiries] = useState<{ id: string; title: string; clientId: string }[]>([]);
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleUnauthorized = () => {
    logout();
    router.replace('/login');
  };

  // Real Clients/Enquiries/Users/Products data — no mock lists, no second
  // data source for any of them (each reuses its own feature's existing
  // API module, same convention as enquiry-form.tsx).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clientResult, enquiryResult, userResult, productResult] = await Promise.all([
          listClients({ status: 'active', pageSize: 100 }),
          // The backend has no clientId filter for enquiries — the full
          // (paginated) set is loaded once and filtered client-side to the
          // selected client below, same approach EnquiryProductSelect uses
          // for its own catalog.
          listEnquiries({ pageSize: 100 }),
          listUsers(),
          listProducts({ status: 'active', pageSize: 100 }),
        ]);
        if (cancelled) return;
        setClients(clientResult.data.map((c) => ({ id: c.id, label: c.name })));
        setEnquiries(enquiryResult.data.map((e) => ({ id: e.id, title: e.title, clientId: e.clientId })));
        setUsers(userResult.map((u) => ({ id: u.id, label: u.name })));
        setProducts(productResult.data.map((p) => ({ id: p.id, label: p.name, price: p.price })));
        setOptionsError('');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }
        setOptionsError('Couldn’t load clients, enquiries, users or products. Reload to retry.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editing: load the real, persisted quotation and prefill every field
  // from it — never from the list row that was clicked.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      setIsLoadingRecord(true);
      try {
        const quotation = await getQuotation(editingId);
        if (cancelled) return;
        setClientId(quotation.clientId);
        setEnquiryId(quotation.enquiryId ?? '');
        setAssignedToId(quotation.assignedTo?.id ?? '');
        setValidUntil(toDateInputValue(quotation.validUntil));
        setNotes(quotation.notes ?? '');
        setTerms(quotation.terms ?? '');
        setQuotationNumber(quotation.quotationNumber);
        setCreatedAt(String(quotation.createdAt));
        setItems(
          quotation.lineItems.length > 0
            ? quotation.lineItems.map((line) => ({
                key: nextKey(),
                id: line.id,
                originalProductId: line.productId,
                productId: line.productId,
                productName: line.productName,
                unitPrice: line.unitPrice,
                description: line.description ?? '',
                quantity: line.quantity,
                discountPercentage: line.discountPercentage,
                taxRate: line.taxRate,
              }))
            : [emptyLine()],
        );
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }
        setLoadError(getQuotationErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoadingRecord(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const updateItem = <K extends keyof BuilderLineItem>(key: string, field: K, value: BuilderLineItem[K]) => {
    setItems((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  };

  /**
   * Handles the product picker for one row. Selecting a real product always
   * previews that product's CURRENT catalog name/price — correct here
   * because either this is a brand-new row (nothing to preserve) or the
   * user just explicitly changed the product on an existing row, both of
   * which the backend will freshly snapshot on save (see api.ts). Picking
   * "Custom" clears productId so the row becomes an ad-hoc line the user
   * fills in by hand.
   */
  const handleProductSelect = (key: string, value: string) => {
    if (value === CUSTOM_PRODUCT) {
      updateItem(key, 'productId', null);
      return;
    }
    const product = productsById.get(value);
    setItems((current) =>
      current.map((line) =>
        line.key === key
          ? { ...line, productId: value, productName: product?.label ?? '', unitPrice: product?.price ?? 0 }
          : line,
      ),
    );
  };

  const addItem = () => setItems((current) => [...current, emptyLine()]);
  const removeItem = (key: string) => setItems((current) => current.filter((line) => line.key !== key));

  const subtotal = items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const totalDiscount = items.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice * (line.discountPercentage / 100),
    0,
  );
  const taxableAmount = subtotal - totalDiscount;
  const totalTax = items.reduce((sum, line) => {
    const afterDiscount = line.quantity * line.unitPrice - line.quantity * line.unitPrice * (line.discountPercentage / 100);
    return sum + afterDiscount * (line.taxRate / 100);
  }, 0);
  const grandTotal = taxableAmount + totalTax;

  const filteredEnquiries = useMemo(
    () => enquiries.filter((e) => !clientId || e.clientId === clientId),
    [enquiries, clientId],
  );

  // An ad-hoc line requires a name and a non-negative price; a catalog line
  // just needs a product picked. Every line needs a positive quantity.
  const linesValid = items.every((line) => {
    if (line.quantity <= 0) return false;
    if (!line.productId) return line.productName.trim().length > 0 && line.unitPrice >= 0;
    return true;
  });
  const canSubmit = clientId.length > 0 && validUntil.length > 0 && items.length > 0 && linesValid && !isSaving;

  const toLineItemInputs = (): QuotationLineItemInput[] =>
    items.map((line) => ({
      id: line.id,
      productId: line.productId ?? undefined,
      productName: line.productId ? undefined : line.productName.trim(),
      unitPrice: line.productId ? undefined : line.unitPrice,
      description: line.description.trim() || undefined,
      quantity: line.quantity,
      discountPercentage: line.discountPercentage,
      taxRate: line.taxRate,
    }));

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setFormError('');
    try {
      if (isEdit && editingId) {
        await updateQuotation(editingId, {
          enquiryId: enquiryId || null,
          assignedToId: assignedToId || null,
          validUntil,
          notes: notes.trim(),
          terms: terms.trim(),
          lineItems: toLineItemInputs(),
        });
        toast.success('Quotation updated');
        router.push(`/quotations/${editingId}`);
      } else {
        const created = await createQuotation({
          clientId,
          enquiryId: enquiryId || undefined,
          assignedToId: assignedToId || undefined,
          validUntil,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          lineItems: toLineItemInputs(),
        });
        toast.success('Quotation saved as draft');
        router.push(`/quotations/${created.id}`);
      }
      // Entered values are intentionally left in place on failure (handled
      // in the catch block below) so the user never loses their work.
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setFormError(getQuotationErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingRecord) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-muted-foreground">Loading quotation…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <p className="text-destructive" role="alert">{loadError}</p>
        <Button variant="outline" onClick={() => router.push('/quotations')}>Back to Quotations</Button>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Quotation' : 'Create Quotation'}</h1>
          <p className="text-slate-500">Professional quotation builder</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header Section */}
        <Card className="p-8 rounded-xl shadow-sm">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">SevenCRM Technologies Pvt. Ltd.</h2>
              <p className="text-slate-500 mt-2 whitespace-pre-wrap">
                123 Business Park, Tower A{'\n'}
                Bengaluru, Karnataka 560001{'\n'}
                GSTIN: 29AABCT1234D1Z5
              </p>
            </div>
            <div className="space-y-4 min-w-[250px]">
              <div>
                <Label className="text-slate-500">Quotation No.</Label>
                <Input
                  value={quotationNumber ?? 'Generated on save'}
                  readOnly
                  className="font-semibold bg-slate-50 rounded-xl"
                />
              </div>
              <div className="flex gap-4">
                {createdAt && (
                  <div className="flex-1">
                    <Label className="text-slate-500">Created</Label>
                    <Input value={new Date(createdAt).toLocaleDateString()} readOnly className="rounded-xl bg-slate-50" />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="q-valid-until">Valid Until *</Label>
                  <Input
                    id="q-valid-until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={isSaving}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t grid gap-6 md:grid-cols-2">
            <div>
              <Label className="text-lg font-semibold mb-4 block">Bill To *</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')} disabled={isSaving || isEdit}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Select Client...">
                    {(value: string) => clients.find((c) => c.id === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="mt-2 text-xs text-muted-foreground">The client can&apos;t be changed after a quotation is created.</p>
              )}
            </div>

            <div>
              <Label className="text-lg font-semibold mb-4 block">Enquiry (optional)</Label>
              <Select value={enquiryId} onValueChange={(v) => setEnquiryId(v ?? '')} disabled={isSaving}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="No linked enquiry">
                    {(value: string) => filteredEnquiries.find((e) => e.id === value)?.title ?? enquiries.find((e) => e.id === value)?.title ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No linked enquiry</SelectItem>
                  {filteredEnquiries.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!clientId && (
                <p className="mt-2 text-xs text-muted-foreground">Select a client first to see its enquiries.</p>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Assigned to</Label>
              <Select value={assignedToId} onValueChange={(v) => setAssignedToId(v ?? '')} disabled={isSaving}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Unassigned">
                    {(value: string) => users.find((u) => u.id === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card className="p-8 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Line Items</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-4">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="pb-3 font-medium text-left">Product</th>
                  <th className="pb-3 font-medium text-center w-24">Qty</th>
                  <th className="pb-3 font-medium text-right w-32">Unit Price</th>
                  <th className="pb-3 font-medium text-right w-24">Disc %</th>
                  <th className="pb-3 font-medium text-right w-24">Tax %</th>
                  <th className="pb-3 font-medium text-right w-32">Amount</th>
                  <th className="pb-3 font-medium text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isCatalog = !!item.productId;
                  return (
                    <tr key={item.key} className="group">
                      <td className="py-4 pr-4 align-top">
                        <Select
                          value={item.productId ?? CUSTOM_PRODUCT}
                          onValueChange={(v) => v && handleProductSelect(item.key, v)}
                          disabled={isSaving}
                        >
                          <SelectTrigger className="rounded-lg mb-2">
                            <SelectValue>
                              {(value: string) => (value === CUSTOM_PRODUCT ? 'Custom / ad-hoc item' : item.productName)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CUSTOM_PRODUCT}>Custom / ad-hoc item</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                            {/* An existing line's product may since have gone
                                inactive; keep it visible/selected even though
                                it is not offered for a fresh selection. */}
                            {item.originalProductId &&
                              !productsById.has(item.originalProductId) &&
                              item.productId === item.originalProductId && (
                                <SelectItem value={item.originalProductId}>{item.productName} (inactive)</SelectItem>
                              )}
                          </SelectContent>
                        </Select>
                        {isCatalog ? (
                          <p className="text-xs text-muted-foreground truncate">{item.productName}</p>
                        ) : (
                          <Input
                            value={item.productName}
                            onChange={(e) => updateItem(item.key, 'productName', e.target.value)}
                            placeholder="Item name"
                            disabled={isSaving}
                            className="font-medium rounded-lg mb-2"
                          />
                        )}
                        <Textarea
                          value={item.description}
                          onChange={(e) => updateItem(item.key, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          disabled={isSaving}
                          className="text-xs resize-none rounded-lg"
                          rows={2}
                        />
                      </td>
                      <td className="py-4 px-2 align-top">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, 'quantity', Number(e.target.value))}
                          className="text-center rounded-lg"
                          min={0.01}
                          step="0.01"
                          disabled={isSaving}
                        />
                      </td>
                      <td className="py-4 px-2 align-top">
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, 'unitPrice', Number(e.target.value))}
                          className="text-right rounded-lg"
                          min={0}
                          step="0.01"
                          disabled={isSaving || isCatalog}
                          title={isCatalog ? 'Priced from the product catalog' : undefined}
                        />
                        {isCatalog && (
                          <p className="mt-1 text-[10px] text-muted-foreground text-right">From catalog</p>
                        )}
                      </td>
                      <td className="py-4 px-2 align-top">
                        <Input
                          type="number"
                          value={item.discountPercentage}
                          onChange={(e) => updateItem(item.key, 'discountPercentage', Number(e.target.value))}
                          className="text-right rounded-lg"
                          min={0}
                          max={100}
                          disabled={isSaving}
                        />
                      </td>
                      <td className="py-4 px-2 align-top">
                        <Input
                          type="number"
                          value={item.taxRate}
                          onChange={(e) => updateItem(item.key, 'taxRate', Number(e.target.value))}
                          className="text-right rounded-lg"
                          min={0}
                          max={100}
                          disabled={isSaving}
                        />
                      </td>
                      <td className="py-4 pl-2 align-top text-right font-medium text-foreground">
                        <div className="mt-2">{formatCurrency(calculateRowTotal(item))}</div>
                      </td>
                      <td className="py-4 align-top text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line item"
                          onClick={() => removeItem(item.key)}
                          disabled={isSaving || items.length === 1}
                          className="mt-1 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button variant="outline" onClick={addItem} disabled={isSaving} className="rounded-xl border-dashed">
            <Plus className="w-4 h-4 mr-2" /> Add Row
          </Button>

          {/* Totals Section — client-side preview only; the backend
              recalculates and persists the authoritative totals on save. */}
          <div className="flex justify-end mt-8 pt-8 border-t">
            <div className="w-full max-w-md space-y-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-foreground pt-4 border-t">
                <span>Grand Total</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Terms */}
        <Card className="p-8 rounded-xl shadow-sm grid gap-6">
          <div>
            <Label className="mb-2 block">Notes to Client</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thank you for your business!"
              disabled={isSaving}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
          <div>
            <Label className="mb-2 block">Terms & Conditions</Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              disabled={isSaving}
              className="rounded-xl text-sm text-slate-500 resize-none h-32"
            />
          </div>
        </Card>

        {optionsError && <p className="text-sm text-destructive" role="alert">{optionsError}</p>}
        {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
      </motion.div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t z-10 flex justify-end gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <Button variant="outline" className="rounded-xl" onClick={() => setIsPreviewOpen(true)} disabled={isSaving}>
          <Eye className="w-4 h-4 mr-2" /> Preview
        </Button>
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => toast.info('PDF generation is not available yet.')}
        >
          <FileText className="w-4 h-4 mr-2" /> Download PDF
        </Button>
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => toast.info('Sending quotations by email is not available yet.')}
        >
          <Send className="w-4 h-4 mr-2" /> Send Email
        </Button>
        <Button className="rounded-xl px-8" onClick={handleSave} disabled={!canSubmit}>
          <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Draft'}
        </Button>
      </div>

      {/* Preview Dialog */}
      <QuotationPreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        data={{
          quotationNumber: quotationNumber ?? 'Draft (not yet saved)',
          clientName: clients.find((c) => c.id === clientId)?.label ?? '',
          validUntil,
          items: items.map((line) => ({
            product: line.productName,
            description: line.description,
            qty: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discountPercentage,
            tax: line.taxRate,
          })),
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          terms,
        }}
      />
    </div>
  );
}
