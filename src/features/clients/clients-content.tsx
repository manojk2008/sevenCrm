"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Plus,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  Eye,
  Edit,
  Trash,
  Building2,
  Mail,
  Phone,
  Search,
  Filter,
  CheckSquare
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientForm } from './client-form';
import type { ClientRecord } from './client-form';
import { clients as clientFixtures } from '@/data/clients';
import { toast } from 'sonner';

// Fallback formatters in case they don't exist
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
const formatRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
};

const initialClients: ClientRecord[] = (clientFixtures as unknown as Array<Record<string, any>>).map((client) => {
  const primary = client.contacts?.find((contact: Record<string, any>) => contact.isPrimary) ?? client.contacts?.[0] ?? {};
  const address = client.addresses?.find((item: Record<string, any>) => item.isPrimary) ?? client.addresses?.[0] ?? {};
  return {
    id: String(client.id),
    name: client.name ?? client.companyName,  
    industry: client.industries?.[0] ?? client.industry ?? "Other",
    email: primary.email ?? client.email ?? "",
    phone: primary.phone ?? client.phone ?? "",
    website: client.website ?? "",
    gstNumber: client.gstNumber ?? "",
    status: client.status === "inactive" ? "inactive" : "active",
    tags: client.tags ?? [],
    revenue: client.totalRevenue ?? client.revenue ?? 0,
    lastActivity: client.updatedAt ?? new Date().toISOString(),
    primaryContact: { name: primary.name ?? "", email: primary.email ?? "", phone: primary.phone ?? "", designation: primary.designation ?? "" },
    address: { line1: address.street ?? address.line1 ?? "", city: address.city ?? "", state: address.state ?? "", pincode: address.pincode ?? "", country: address.country ?? "India" },
    notes: client.notes ?? "",
  };
});

export function ClientsContent() {
  const [data, setData] = useState<ClientRecord[]>(initialClients);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | undefined>(undefined);

  const columns: ColumnDef<ClientRecord>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Company',
      cell: ({ row }) => {
        const client = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              {getInitials(client.name)}
            </div>
            <div>
              <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                {client.name}
              </Link>
              <div className="text-xs text-gray-500 mt-0.5">{client.contactperson}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => {
        const client = row.original;
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{client.primaryContact?.name || 'N/A'}</div>
            <div className="text-xs text-gray-500">{client.primaryContact?.email || 'N/A'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.phone}</span>
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
            {tags.length > 2 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{tags.length - 2}</Badge>}
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.status === 'active';
        return (
          <Badge className={cn("capitalize", isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100")}>
            {row.original.status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'revenue',
      header: () => <div className="text-right">Revenue</div>,
      cell: ({ row }) => <div className="text-right font-medium text-gray-900">{formatCurrency(row.original.revenue || 0)}</div>
    },
    {
      accessorKey: 'lastActivity',
      header: 'Last Activity',
      cell: ({ row }) => <span className="text-sm text-gray-500">{formatRelativeTime(row.original.lastActivity)}</span>
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const client = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                render={
                  <Link href={`/clients/${client.id}`}>
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </Link>
                }
              />
              <DropdownMenuItem onClick={() => { setEditingClient(client); setIsFormOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit Client
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={() => {
                setData((records) => records.filter((record) => record.id !== client.id));
                toast.success("Client deleted");
              }}>
                <Trash className="mr-2 h-4 w-4" /> Delete Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your client portfolio and relationships.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Client export is ready")}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => { setEditingClient(undefined); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search clients..."
              className="pl-9 bg-gray-50/50 border-gray-200 focus-visible:ring-indigo-500"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <Select onValueChange={(v) => table.getColumn('status')?.setFilterValue(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] bg-gray-50/50 border-gray-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 border bg-gray-50 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('table')}
            className={cn("h-8 px-2 rounded-md", view === 'table' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('grid')}
            className={cn("h-8 px-2 rounded-md", view === 'grid' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center justify-between"
          >
            <span className="text-sm font-medium text-indigo-800">
              {selectedRows.length} client{selectedRows.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => toast.success("Selected clients exported")}>
                Export Selected
              </Button>
              <Button variant="destructive" size="sm" onClick={() => {
                const ids = new Set(selectedRows.map((row) => row.original.id));
                setData((records) => records.filter((record) => !ids.has(record.id)));
                table.resetRowSelection();
                toast.success("Selected clients deleted");
              }}>
                Delete Selected
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {view === 'table' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-gray-50/50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Building2 className="h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-base font-medium text-gray-900">No clients found</p>
                        <p className="text-sm">We couldn&apos;t find any clients matching your criteria.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing {table.getRowModel().rows.length} of {data.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {table.getRowModel().rows.map((row) => {
            const client = row.original;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={client.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative"
              >
                <div className="absolute top-4 right-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={
                          <Link href={`/clients/${client.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Link>
                        }
                      />
                      <DropdownMenuItem onClick={() => { setEditingClient(client); setIsFormOpen(true); }}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
                    {getInitials(client.name)}
                  </div>
                  <div>
                    <Link href={`/clients/${client.id}`} className="font-semibold text-gray-900 hover:text-indigo-600 truncate block">
                      {client.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{client.contactperson}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 capitalize", client.status === 'active' ? "bg-emerald-50 text-emerald-700" : "")}>
                        {client.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CheckSquare className="w-4 h-4 mr-2 text-gray-400" />
                    {client.primaryContact?.name || 'No primary contact'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    {client.primaryContact?.email || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {client.phone}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Revenue</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(client.revenue || 0)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {client.tags?.slice(0, 2).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {table.getRowModel().rows.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
              <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-900">No clients found</p>
              <p className="text-sm text-gray-500">We couldn&apos;t find any clients matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Form Sheet */}
      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onSubmit={(data) => {
          setData((records) => {
            const exists = records.some((record) => record.id === data.id);
            return exists ? records.map((record) => record.id === data.id ? data : record) : [data, ...records];
          });
        }}
      />
    </div>
  );
}
