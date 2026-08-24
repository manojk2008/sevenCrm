"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';

interface QuotationPreviewLine {
  product: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
}

interface QuotationPreviewData {
  quotationNumber: string;
  clientName: string;
  validUntil: string;
  items: QuotationPreviewLine[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  terms: string;
}

export function QuotationPreview({ open, onOpenChange, data }: { open: boolean, onOpenChange: (open: boolean) => void, data: QuotationPreviewData }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="hidden">
           <DialogTitle>Quotation Preview</DialogTitle>
           <DialogDescription>Preview the quotation before printing.</DialogDescription>
        </div>
        <div className="bg-slate-100 dark:bg-slate-900 border-b p-4 flex justify-between items-center no-print">
          <h2 className="font-semibold flex items-center gap-2">Preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-lg">
              <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close preview" onClick={() => onOpenChange(false)} className="rounded-lg">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible bg-slate-50 dark:bg-slate-950">
          <div className="bg-card text-foreground p-12 max-w-3xl mx-auto shadow-sm print:shadow-none min-h-[1056px] relative">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-8 mb-8">
              <div>
                <h1 className="mb-2 text-4xl font-bold tracking-tight text-primary">QUOTATION</h1>
                <p className="text-sm font-semibold">SevenCRM Technologies Pvt. Ltd.</p>
                <p className="text-xs text-slate-500">123 Business Park, Tower A<br/>Bengaluru, Karnataka 560001<br/>GSTIN: 29AABCT1234D1Z5</p>
              </div>
              <div className="text-right">
                <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-slate-500">Quotation No:</span>
                  <span className="font-semibold">{data.quotationNumber}</span>
                  <span className="text-slate-500">Date:</span>
                  <span>{format(new Date(), 'dd MMM yyyy')}</span>
                  <span className="text-slate-500">Valid Until:</span>
                  <span>{data.validUntil ? format(new Date(data.validUntil), 'dd MMM yyyy') : '—'}</span>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To:</p>
              <h3 className="font-bold text-lg">{data.clientName || 'No client selected'}</h3>
            </div>

            {/* Items */}
            <table className="w-full text-sm mb-8">
              <thead className="bg-muted">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold rounded-tl-lg">Description</th>
                  <th className="py-3 px-4 text-center font-semibold">Qty</th>
                  <th className="py-3 px-4 text-right font-semibold">Unit Price</th>
                  <th className="py-3 px-4 text-right font-semibold">Tax</th>
                  <th className="py-3 px-4 text-right font-semibold rounded-tr-lg">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-b">
                {data.items.map((item, i) => {
                  const afterDiscount = (item.qty * item.unitPrice) - ((item.qty * item.unitPrice) * (item.discount / 100));
                  const final = afterDiscount + (afterDiscount * (item.tax / 100));
                  
                  return (
                    <tr key={i}>
                      <td className="py-4 px-4">
                        <p className="font-semibold">{item.product || 'Item Name'}</p>
                        {item.description && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{item.description}</p>}
                      </td>
                      <td className="py-4 px-4 text-center">{item.qty}</td>
                      <td className="py-4 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 px-4 text-right">{item.tax}%</td>
                      <td className="py-4 px-4 text-right font-medium">{formatCurrency(final)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="w-72">
                <div className="flex justify-between py-1 text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(data.subtotal)}</span>
                </div>
                {data.totalDiscount > 0 && (
                  <div className="flex justify-between py-1 text-sm text-emerald-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(data.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 text-sm text-muted-foreground">
                  <span>Tax:</span>
                  <span>{formatCurrency(data.totalTax)}</span>
                </div>
                <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-900 dark:border-white font-bold text-lg">
                  <span>Grand Total:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(data.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            {data.terms && (
              <div className="text-xs text-slate-500 mt-auto pt-8 border-t">
                <p className="font-bold text-foreground mb-2">Terms & Conditions:</p>
                <p className="whitespace-pre-wrap">{data.terms}</p>
              </div>
            )}
            
            {/* Signature */}
            <div className="absolute bottom-12 right-12 text-center text-sm">
              <div className="w-48 border-b border-slate-400 mb-2 h-16"></div>
              <p className="font-semibold text-foreground">Authorized Signature</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
