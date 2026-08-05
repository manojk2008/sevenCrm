"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Download, Send, Copy, Eye, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const mockQuotations = Array.from({ length: 15 }).map((_, i) => {
  const statuses = ['Draft', 'Pending', 'Accepted', 'Rejected', 'Expired'];
  const status = statuses[i % statuses.length];

  return {
    id: `QT-2024-${String(1000 + i).padStart(4, '0')}`,
    client: `Client Company ${i + 1}`,
    amount: Math.floor(Math.random() * 500000) + 10000,
    status,
    date: new Date(Date.now() - Math.random() * 10000000000),
    validUntil: new Date(Date.now() + Math.random() * 10000000000),
  };
});

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Pending: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    Accepted: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    Rejected: 'bg-red-100 text-red-700 hover:bg-red-200',
    Expired: 'bg-slate-800 text-slate-100',
  };
  return <Badge className={`${styles[status]} font-medium border-0`}>{status}</Badge>;
};

export function QuotationsContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = mockQuotations.filter(q =>
    q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Quotations</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create and manage professional quotations</p>
        </div>
        <Button onClick={() => router.push('/quotations/builder')} className="rounded-xl shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Create Quotation
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Quotation #</th>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Valid Until</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{row.id}</td>
                  <td className="px-6 py-4 font-medium">{row.client}</td>
                  <td className="px-6 py-4">{formatCurrency(row.amount)}</td>
                  <td className="px-6 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-6 py-4 text-slate-500">{format(row.date, 'dd MMM yyyy')}</td>
                  <td className="px-6 py-4 text-slate-500">{format(row.validUntil, 'dd MMM yyyy')}</td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                        <DropdownMenuItem><FileText className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem><Send className="mr-2 h-4 w-4" /> Send Email</DropdownMenuItem>
                        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Download PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              No quotations found.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
