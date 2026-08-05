"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Eye, FileText, Send, ArrowLeft, GripVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { QuotationPreview } from './quotation-preview';

type LineItem = {
  id: string;
  product: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
};

export function QuotationBuilder() {
  const router = useRouter();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [client, setClient] = useState('');
  
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', product: 'Enterprise CRM License', description: 'Annual subscription per user', qty: 10, unitPrice: 25000, discount: 0, tax: 18 }
  ]);

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addItem = () => {
    setItems([...items, { 
      id: Math.random().toString(), 
      product: '', 
      description: '', 
      qty: 1, 
      unitPrice: 0, 
      discount: 0, 
      tax: 18 
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  // Calculations
  const calculateRowTotal = (item: LineItem) => {
    const base = item.qty * item.unitPrice;
    const afterDiscount = base - (base * (item.discount / 100));
    return afterDiscount + (afterDiscount * (item.tax / 100));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const totalDiscount = items.reduce((sum, item) => sum + ((item.qty * item.unitPrice) * (item.discount / 100)), 0);
  const taxableAmount = subtotal - totalDiscount;
  const totalTax = items.reduce((sum, item) => {
    const afterDiscount = (item.qty * item.unitPrice) - ((item.qty * item.unitPrice) * (item.discount / 100));
    return sum + (afterDiscount * (item.tax / 100));
  }, 0);
  
  // Assuming intra-state for demo (CGST + SGST split)
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const grandTotal = taxableAmount + totalTax;

  return (
    <div className="pb-24 max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Quotation</h1>
          <p className="text-slate-500">Professional quotation builder</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        
        {/* Header Section */}
        <Card className="p-8 rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
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
                <Input value="QT-2024-0042" readOnly className="font-semibold bg-slate-50 rounded-xl" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-slate-500">Date</Label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="rounded-xl" />
                </div>
                <div className="flex-1">
                  <Label className="text-slate-500">Valid Until</Label>
                  <Input type="date" defaultValue={new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]} className="rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
            <Label className="text-lg font-semibold mb-4 block">Bill To</Label>
            <div className="max-w-md">
              <Select value={client} onValueChange={setClient}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client1">Tech Innovations Ltd.</SelectItem>
                  <SelectItem value="client2">Global Services Inc.</SelectItem>
                </SelectContent>
              </Select>
              
              {client && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1 text-sm">
                  <p className="font-bold">Tech Innovations Ltd.</p>
                  <p>Mr. Rajesh Kumar</p>
                  <p>rajesh@techinnovations.com</p>
                  <p>+91 98765 43210</p>
                  <p className="text-slate-500">45 Industrial Area, Phase 2, Pune, 411057</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card className="p-8 rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold mb-4">Line Items</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-4">
              <thead className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="pb-3 font-medium text-left w-8"></th>
                  <th className="pb-3 font-medium text-left">Product / Description</th>
                  <th className="pb-3 font-medium text-center w-24">Qty</th>
                  <th className="pb-3 font-medium text-right w-32">Unit Price (₹)</th>
                  <th className="pb-3 font-medium text-right w-24">Disc %</th>
                  <th className="pb-3 font-medium text-right w-24">Tax %</th>
                  <th className="pb-3 font-medium text-right w-32">Amount (₹)</th>
                  <th className="pb-3 font-medium text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, index) => (
                  <tr key={item.id} className="group">
                    <td className="py-4 align-top">
                      <div className="mt-3 cursor-grab text-slate-400 hover:text-slate-600">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <Input 
                        value={item.product} 
                        onChange={(e) => updateItem(item.id, 'product', e.target.value)}
                        placeholder="Product Name" 
                        className="font-medium rounded-lg mb-2" 
                      />
                      <Textarea 
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Description (Optional)" 
                        className="text-xs resize-none rounded-lg" 
                        rows={2}
                      />
                    </td>
                    <td className="py-4 px-2 align-top">
                      <Input 
                        type="number" 
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))}
                        className="text-center rounded-lg" 
                        min={1} 
                      />
                    </td>
                    <td className="py-4 px-2 align-top">
                      <Input 
                        type="number" 
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="text-right rounded-lg" 
                        min={0} 
                      />
                    </td>
                    <td className="py-4 px-2 align-top">
                      <Input 
                        type="number" 
                        value={item.discount}
                        onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value))}
                        className="text-right rounded-lg" 
                        min={0} max={100} 
                      />
                    </td>
                    <td className="py-4 px-2 align-top">
                      <Select value={item.tax.toString()} onValueChange={(v) => updateItem(item.id, 'tax', Number(v))}>
                        <SelectTrigger className="rounded-lg h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-4 pl-2 align-top text-right font-medium text-slate-700 dark:text-slate-300">
                      <div className="mt-2">{formatCurrency(calculateRowTotal(item))}</div>
                    </td>
                    <td className="py-4 align-top text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="mt-1 text-slate-400 hover:text-red-500 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Button variant="outline" onClick={addItem} className="rounded-xl border-dashed">
            <Plus className="w-4 h-4 mr-2" /> Add Row
          </Button>
          
          {/* Totals Section */}
          <div className="flex justify-end mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
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
                <span>Taxable Amount</span>
                <span>{formatCurrency(taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>CGST (9%)</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>SGST (9%)</span>
                <span>{formatCurrency(sgst)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-4 border-t border-slate-200 dark:border-slate-800">
                <span>Grand Total</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Terms */}
        <Card className="p-8 rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 grid gap-6">
          <div>
            <Label className="mb-2 block">Notes to Client</Label>
            <Textarea placeholder="Thank you for your business!" className="rounded-xl resize-none" rows={3} />
          </div>
          <div>
            <Label className="mb-2 block">Terms & Conditions</Label>
            <Textarea 
              className="rounded-xl text-sm text-slate-500 resize-none h-32"
              defaultValue={`1. Payment terms: 50% advance, balance on delivery.
2. Quotation valid for 15 days from the date of issue.
3. Any additional requirements will be billed separately.
4. Annual maintenance charges are subject to revision.`} 
            />
          </div>
        </Card>

      </motion.div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-10 flex justify-end gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <Button variant="outline" className="rounded-xl" onClick={() => toast.success('Saved as draft')}>
          <Save className="w-4 h-4 mr-2" /> Save Draft
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => setIsPreviewOpen(true)}>
          <Eye className="w-4 h-4 mr-2" /> Preview
        </Button>
        <Button variant="secondary" className="rounded-xl" onClick={() => toast.success('PDF Generation coming soon!')}>
          <FileText className="w-4 h-4 mr-2" /> Download PDF
        </Button>
        <Button className="rounded-xl px-8">
          <Send className="w-4 h-4 mr-2" /> Send Email
        </Button>
      </div>

      {/* Preview Dialog */}
      <QuotationPreview 
        open={isPreviewOpen} 
        onOpenChange={setIsPreviewOpen}
        data={{ items, subtotal, totalDiscount, taxableAmount, cgst, sgst, grandTotal }}
      />
    </div>
  );
}
