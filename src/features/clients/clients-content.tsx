"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Trash2,
  RotateCcw,
  Building2,
  Mail,
  Phone,
  Search,
  CheckSquare
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/skeleton-loader';
import { ClientForm } from './client-form';
import type { ClientRecord, ClientFormValues } from './client-form';
import { listClients, saveClientForm, updateClientStatus, deleteClient, getClientErrorMessage } from './api';
import { EnquiryForm } from '@/features/enquiries/enquiry-form';
import { createEnquiry, type EnquiryFormValues } from '@/features/enquiries/api';
import { ensureNextFollowUp } from '@/features/enquiries/follow-up-sync';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime, getInitials } from '@/lib/format';

type StatusFilter = 'all' | 'active' | 'inactive';
type LoadState = 'loading' | 'error' | 'ready';

const PAGE_SIZE = 10;

const STATUS_FILTER_VALUES: StatusFilter[] = ['all', 'active', 'inactive'];

function isStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_FILTER_VALUES.includes(value as StatusFilter);
}

export function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  // UX gating only — the backend (SUPER_ADMIN/ADMIN on every delete) remains
  // the actual authorization boundary, same pattern as ProductsContent's
  // canManage.
  const canDelete = currentUser?.role === 'super-admin' || currentUser?.role === 'admin';

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Seeded from `?status=` when present and valid (e.g. the Dashboard's
  // "Total Clients" KPI card links to `/clients?status=all`) — falls back to
  // the existing default otherwise. Read once via a lazy initializer, same
  // as every other piece of state here; the existing Select UI is the only
  // way to change it afterward.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const param = searchParams.get('status');
    return isStatusFilter(param) ? param : 'active';
  });

  const [view, setView] = useState<'table' | 'grid'>('table');
  const [rowSelection, setRowSelection] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | undefined>(undefined);
  const [clientToDeactivate, setClientToDeactivate] = useState<ClientRecord | null>(null);
  const [churnReasonInput, setChurnReasonInput] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Set right after a new client is created with "Add enquiry after
  // creating client" checked — opens the existing EnquiryForm pre-filled
  // with that client, so the user never has to search for it again.
  const [enquiryPrefillClient, setEnquiryPrefillClient] = useState<ClientRecord | null>(null);
  const [isEnquiryFormOpen, setIsEnquiryFormOpen] = useState(false);

  // A 401 means the session is gone — the backend is authoritative, so we
  // clear local state and send the user back to login rather than leaving a
  // stale "authenticated" UI showing (mirrors users-content.tsx).
  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const loadClients = useCallback(async () => {
    setLoadState('loading');
    try {
      const result = await listClients({ search, status: statusFilter, page, pageSize: PAGE_SIZE });
      setClients(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadErrorMessage(getClientErrorMessage(error));
      setLoadState('error');
    }
  }, [search, statusFilter, page, handleUnauthorized]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Debounce free-text search before it drives a request.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // A new search/filter always starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const columns: ColumnDef<ClientRecord>[] = [
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
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {getInitials(client.name)}
            </div>
            <div>
              <Link href={`/clients/${client.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                {client.name}
              </Link>
              <div className="text-xs text-muted-foreground mt-0.5">{client.contactperson}</div>
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
            <div className="text-sm font-medium text-foreground">{client.primaryContact?.name || 'N/A'}</div>
            <div className="text-xs text-muted-foreground">{client.primaryContact?.email || 'N/A'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.phone}</span>
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[11px] px-1.5 py-0">{tag}</Badge>
            ))}
            {tags.length > 2 && <Badge variant="outline" className="text-[11px] px-1.5 py-0">+{tags.length - 2}</Badge>}
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
          <Badge variant={isActive ? "success" : "secondary"} className="capitalize">
            {row.original.status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'revenue',
      header: () => <div className="text-right">Revenue</div>,
      cell: ({ row }) => <div className="text-right font-medium text-foreground">{formatCurrency(row.original.revenue || 0)}</div>
    },
    {
      accessorKey: 'lastActivity',
      header: 'Last Activity',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.lastActivity)}</span>
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const client = row.original;
        const isActive = client.status === 'active';
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
              {isActive ? (
                <DropdownMenuItem className="text-destructive" onClick={() => { setClientToDeactivate(client); setChurnReasonInput(''); }}>
                  <Trash className="mr-2 h-4 w-4" /> Deactivate Client
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleReactivate(client)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reactivate Client
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => { setClientToDelete(client); setDeleteError(''); }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  const handleFormSubmit = async (values: ClientFormValues) => {
    const isCreating = !editingClient;
    const saved = await saveClientForm(values, editingClient, (message) => toast.warning(message));
    // Triggered before the list refresh below: the client is already
    // genuinely saved at this point (saveClientForm returned), so a
    // subsequent refresh hiccup must not block the promised hand-off into
    // the Enquiry form.
    if (isCreating && values.addEnquiryAfterCreate) {
      setEnquiryPrefillClient(saved);
      setIsEnquiryFormOpen(true);
    }
    await loadClients();
  };

  const handleEnquirySubmit = async (values: EnquiryFormValues) => {
    const created = await createEnquiry(values);
    toast.success('Enquiry created');
    setIsEnquiryFormOpen(false);
    setEnquiryPrefillClient(null);
    // Automatic Next Follow-up, created directly and sequentially right
    // after the Enquiry — same behavior as the Enquiries page's own create
    // flow. A failure here must not be mistaken for the Enquiry itself
    // failing: it already exists, so this is reported as its own warning
    // rather than swallowed or retried (see ensureNextFollowUp).
    await ensureNextFollowUp(created);
    await loadClients();
  };

  const handleReactivate = async (targetClient: ClientRecord) => {
    try {
      await updateClientStatus(targetClient.id, 'active');
      toast.success(`${targetClient.name} has been reactivated`);
      await loadClients();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getClientErrorMessage(error));
    }
  };

  const handleDeactivate = async () => {
    if (!clientToDeactivate || !churnReasonInput.trim()) return;
    setIsDeactivating(true);
    try {
      await updateClientStatus(clientToDeactivate.id, 'inactive', churnReasonInput.trim());
      toast.success(`${clientToDeactivate.name} has been deactivated`);
      setClientToDeactivate(null);
      setChurnReasonInput('');
      await loadClients();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getClientErrorMessage(error));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteClient(clientToDelete.id);
      toast.success(`${clientToDelete.name} has been permanently deleted`);
      setClientToDelete(null);
      await loadClients();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      // Keep the client and the dialog usable — most commonly a 409 because
      // related enquiries/quotations/follow-ups still exist.
      setDeleteError(getClientErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your client portfolio and relationships.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Client export is ready")}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => { setEditingClient(undefined); setIsFormOpen(true); }} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-9 bg-muted/40 border-border focus-visible:ring-ring"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px] bg-muted/40 border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 border bg-muted/40 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('table')}
            aria-label="Table view"
            aria-pressed={view === 'table'}
            className={cn("h-8 px-2 rounded-md", view === 'table' ? "bg-card shadow-sm text-primary" : "text-muted-foreground")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={cn("h-8 px-2 rounded-md", view === 'grid' ? "bg-card shadow-sm text-primary" : "text-muted-foreground")}
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
            className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between"
          >
            <span className="text-sm font-medium text-primary">
              {selectedRows.length} client{selectedRows.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-card border-primary/30 text-primary hover:bg-primary/10" onClick={() => toast.success("Selected clients exported")}>
                Export Selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => toast.info("Deactivate clients one at a time so a reason can be recorded for each.")}
              >
                Deactivate Selected
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loadState === 'loading' && <TableSkeleton rows={PAGE_SIZE} />}

      {loadState === 'error' && (
        <ErrorState title="Couldn't load clients" description={loadErrorMessage} onRetry={loadClients} />
      )}

      {loadState === 'ready' && (view === 'table' ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col min-h-[500px]">
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-muted/40">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <p className="text-base font-medium text-foreground">No clients found</p>
                        <p className="text-sm mb-4">We couldn&apos;t find any clients matching your criteria.</p>
                        <Button size="sm" onClick={() => { setEditingClient(undefined); setIsFormOpen(true); }} className="bg-primary hover:bg-primary/90">
                          <Plus className="mr-2 h-4 w-4" /> Add Client
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {clients.length} of {total} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
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
                className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow group relative flex flex-col h-full"
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
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                    {getInitials(client.name)}
                  </div>
                  <div>
                    <Link href={`/clients/${client.id}`} className="font-semibold text-foreground hover:text-primary truncate block">
                      {client.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{client.contactperson}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <Badge variant={client.status === 'active' ? "success" : "secondary"} className="text-[11px] px-1.5 py-0 capitalize">
                        {client.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CheckSquare className="w-4 h-4 mr-2 text-muted-foreground" />
                    {client.primaryContact?.name || 'No primary contact'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                    {client.primaryContact?.email || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                    {client.phone}
                  </div>
                </div>

                <div className="pt-4 mt-auto border-t border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Revenue</p>
                    <p className="font-semibold text-foreground">{formatCurrency(client.revenue || 0)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {client.tags?.slice(0, 2).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[11px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {clients.length === 0 && (
            <div className="col-span-full py-16 text-center bg-card rounded-xl shadow-sm border border-border flex flex-col items-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">No clients found</p>
              <p className="text-sm text-muted-foreground mb-6">We couldn&apos;t find any clients matching your criteria.</p>
              <Button onClick={() => { setEditingClient(undefined); setIsFormOpen(true); }} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Add Client
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Form Sheet */}
      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onSubmit={handleFormSubmit}
      />

      {/* Opened right after a new client is created with "Add enquiry after
          creating client" checked — same EnquiryForm used on the Enquiries
          page, just pre-selecting the client that was just created. */}
      {isEnquiryFormOpen && enquiryPrefillClient && (
        <EnquiryForm
          open={isEnquiryFormOpen}
          onOpenChange={(open) => {
            setIsEnquiryFormOpen(open);
            if (!open) setEnquiryPrefillClient(null);
          }}
          initialClientId={enquiryPrefillClient.id}
          onSubmit={handleEnquirySubmit}
        />
      )}

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!clientToDeactivate} onOpenChange={(open) => !open && !isDeactivating && setClientToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{clientToDeactivate?.name}</strong> as inactive. You can reactivate them later from this page or the client&apos;s detail page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deactivate-reason">Reason for deactivation *</Label>
            <Textarea
              id="deactivate-reason"
              value={churnReasonInput}
              onChange={(e) => setChurnReasonInput(e.target.value)}
              placeholder="Why is this client being deactivated?"
              disabled={isDeactivating}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
              disabled={!churnReasonInput.trim() || isDeactivating}
              onClick={handleDeactivate}
            >
              {isDeactivating ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!clientToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setClientToDelete(null);
            setDeleteError('');
          }
        }}
        title="Delete this client?"
        description={
          deleteError ||
          `Are you sure you want to permanently delete "${clientToDelete?.name}"? This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
