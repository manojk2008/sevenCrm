"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, LayoutGrid, List as ListIcon, 
  MoreVertical, Edit, Trash2, Filter
} from 'lucide-react';
import { 
  useReactTable, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, getFilteredRowModel, flexRender,
  createColumnHelper
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProductForm } from './product-form';
import { formatCurrency } from '@/lib/format';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'Active' | 'Inactive';
  gstRate: number;
};

const mockProducts: Product[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `PRD-${String(i + 1).padStart(3, '0')}`,
  name: `Enterprise Software License ${i + 1}`,
  category: i % 2 === 0 ? 'Software' : 'Service',
  price: Math.floor(Math.random() * 50000) + 5000,
  stock: Math.floor(Math.random() * 500),
  status: i % 5 === 0 ? 'Inactive' : 'Active',
  gstRate: 18
}));

const columnHelper = createColumnHelper<Product>();

export function ProductsContent() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => <span className="font-medium text-slate-900 dark:text-slate-100">{info.getValue()}</span>
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: info => <Badge variant="secondary" className="rounded-md">{info.getValue()}</Badge>
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: info => formatCurrency(info.getValue())
    }),
    columnHelper.accessor('stock', {
      header: 'Stock',
      cell: info => info.getValue()
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <Badge variant={info.getValue() === 'Active' ? 'default' : 'destructive'} className={info.getValue() === 'Active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
          {info.getValue()}
        </Badge>
      )
    }),
    columnHelper.accessor('gstRate', {
      header: 'GST Rate',
      cell: info => `${info.getValue()}%`
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(row.original); setIsFormOpen(true); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    })
  ];

  const table = useReactTable({
    data: mockProducts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Products</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your product catalog and inventory</p>
        </div>
        <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }} className="rounded-xl shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-9 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="rounded-xl hidden sm:flex">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
            <Button 
              variant={view === 'table' ? 'default' : 'ghost'} 
              size="icon" 
              className={`rounded-lg h-8 w-8 ${view === 'table' ? 'shadow-sm' : ''}`}
              onClick={() => setView('table')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant={view === 'grid' ? 'default' : 'ghost'} 
              size="icon"
              className={`rounded-lg h-8 w-8 ${view === 'grid' ? 'shadow-sm' : ''}`}
              onClick={() => setView('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'table' ? (
          <motion.div 
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-6 py-4 font-medium">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing {table.getRowModel().rows.length} of {mockProducts.length} results
              </span>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => table.previousPage()} 
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => table.nextPage()} 
                  disabled={!table.getCanNextPage()}
                  className="rounded-xl"
                >
                  Next
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {table.getRowModel().rows.map(row => (
              <Card key={row.id} className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-6 relative">
                  <Badge variant="secondary" className="absolute top-4 left-4">{row.original.category}</Badge>
                  <Badge 
                    variant={row.original.status === 'Active' ? 'default' : 'destructive'} 
                    className={`absolute top-4 right-4 ${row.original.status === 'Active' ? 'bg-emerald-500' : ''}`}
                  >
                    {row.original.status}
                  </Badge>
                  <div className="text-slate-300 dark:text-slate-600">
                    <LayoutGrid className="w-16 h-16 opacity-20" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">{row.original.name}</h3>
                  <div className="flex items-end justify-between mt-4">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(row.original.price)}</p>
                      <p className="text-xs text-slate-500 mt-1">Stock: {row.original.stock}</p>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(row.original); setIsFormOpen(true); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <ProductForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        product={editingProduct} 
      />
    </motion.div>
  );
}
