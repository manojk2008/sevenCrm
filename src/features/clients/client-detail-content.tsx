"use client";

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Globe, MapPin, Send, MoreHorizontal, UploadCloud, Edit, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatCardSkeleton } from '@/components/shared/skeleton-loader';
import { ClientForm } from './client-form';
import type { ClientRecord, ClientFormValues } from './client-form';
import { getClient, saveClientForm, updateClientStatus, getClientErrorMessage } from './api';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatRelativeTime, getInitials } from '@/lib/format';
import { toast } from 'sonner';

type LoadState = 'loading' | 'error' | 'not-found' | 'ready';

export function ClientDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [churnReasonInput, setChurnReasonInput] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const loadClient = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await getClient(id);
      setClient(data);
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
      setLoadErrorMessage(getClientErrorMessage(error));
      setLoadState('error');
    }
  }, [id, handleUnauthorized]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (loadState === 'loading') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (loadState === 'not-found') {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/clients" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </div>
        <EmptyState
          icon={Building2}
          title="Client not found"
          description={`We couldn't find a client with ID "${id}". It may have been removed, or the link you followed is incorrect.`}
        />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/clients" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </div>
        <ErrorState title="Couldn't load this client" description={loadErrorMessage} onRetry={loadClient} />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const handleFormSubmit = async (values: ClientFormValues) => {
    const saved = await saveClientForm(values, client, (message) => toast.warning(message));
    setClient(saved);
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      const updated = await updateClientStatus(client.id, 'active');
      setClient(updated);
      toast.success('Client reactivated');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(getClientErrorMessage(error));
    } finally {
      setIsReactivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!churnReasonInput.trim()) return;
    setIsDeactivating(true);
    try {
      const updated = await updateClientStatus(client.id, 'inactive', churnReasonInput.trim());
      setClient(updated);
      toast.success('Client deactivated');
      setIsDeactivateOpen(false);
      setChurnReasonInput('');
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

  const contacts = client.contacts ?? [];

  return (
    <div className="space-y-6">
      {/* Back & Breadcrumb */}
      <div>
        <Link href="/clients" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      {/* Header Section */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shrink-0">
            {getInitials(client.name)}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <Badge variant="secondary" className="capitalize text-xs">{client.industry}</Badge>
              <Badge className={client.status === 'active' ? "bg-success/10 text-success hover:bg-success/10" : "bg-muted text-foreground hover:bg-muted"}>
                {client.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-3">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground" /> {client.address.city}, {client.address.state}</span>
              {client.website && (
                <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-muted-foreground" /> {client.website}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button className="bg-primary hover:bg-primary/90" render={<a href={`mailto:${client.email}`} />}>
            <Send className="mr-2 h-4 w-4" /> Email
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label="More client actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast.info("Creating an enquiry from a client isn't available yet.")}>Create Enquiry</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Creating a quotation from a client isn't available yet.")}>Create Quotation</DropdownMenuItem>
              <DropdownMenuSeparator />
              {client.status === 'active' ? (
                <DropdownMenuItem className="text-destructive" onClick={() => { setChurnReasonInput(''); setIsDeactivateOpen(true); }}>
                  Deactivate Client
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleReactivate} disabled={isReactivating}>
                  <RotateCcw className="mr-2 h-4 w-4" /> {isReactivating ? "Reactivating…" : "Reactivate Client"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Deals', value: client.totalDeals ?? 'N/A' },
          { label: 'Total Revenue', value: formatCurrency(client.revenue || 0) },
          { label: 'Open Enquiries', value: 'N/A' },
          { label: 'Last Activity', value: client.updatedAt ? formatRelativeTime(client.updatedAt) : 'N/A' },
        ].map((metric, i) => (
          <Card key={i} className="rounded-xl border-border shadow-sm">
            <CardContent className="p-4 md:p-5">
              <p className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-12 p-0 gap-6 overflow-x-auto overflow-y-hidden">
          {['Overview', 'Contacts', 'Deals', 'Quotations', 'Documents', 'Timeline', 'Notes'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-xl border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                    <div className="col-span-2 text-sm text-foreground">{client.email}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div className="col-span-2 text-sm text-foreground">{client.phone}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Website</div>
                    <div className="col-span-2 text-sm text-primary hover:underline cursor-pointer">{client.website || 'N/A'}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-muted-foreground">GST Number</div>
                    <div className="col-span-2 text-sm text-foreground font-mono">{client.gstNumber || 'N/A'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground space-y-1">
                      <p>{client.address.line1}</p>
                      {client.address.line2 && <p>{client.address.line2}</p>}
                      <p>{client.address.city}, {client.address.state} {client.address.pincode}</p>
                      <p>{client.address.country}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contacts">
            <Card className="rounded-xl border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Contacts</h3>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Contact</Button>
              </div>
              {contacts.length > 0 ? (
                <div className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="p-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {getInitials(contact.name)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            {contact.name}
                            {contact.isPrimary && <Badge variant="secondary" className="text-[11px] px-1.5 py-0">Primary</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{contact.designation || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground shrink-0">
                        <div>{contact.email || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{contact.phone || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">No contacts on file for this client.</div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card className="rounded-xl border-border shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No deals yet</h3>
              <p className="text-sm text-muted-foreground mb-4">This client doesn&apos;t have any active deals or enquiries.</p>
              <Button variant="outline">Create Deal</Button>
            </Card>
          </TabsContent>

          <TabsContent value="quotations">
            <Card className="rounded-xl border-border shadow-sm p-12 text-center text-muted-foreground">
              No quotations available.
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-muted/40 transition-colors cursor-pointer">
                <UploadCloud className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-base font-medium text-foreground mb-1">Upload Documents</h3>
                <p className="text-sm text-muted-foreground mb-4">Drag and drop files here, or click to browse</p>
                <Button variant="outline" size="sm">Select Files</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <Card className="rounded-xl border-border shadow-sm p-6">
              <div className="relative pl-6 space-y-6 border-l-2 border-border ml-3">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-primary/10 border-2 border-primary" />
                    <div className="text-sm font-medium text-foreground mb-1">Client created</div>
                    <div className="text-xs text-muted-foreground">Added by Manoj • {i + 1} days ago</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="rounded-xl border-border shadow-sm p-6 text-center text-muted-foreground">
              Notes section here.
            </Card>
          </TabsContent>

        </div>
      </Tabs>

      {/* Edit Form */}
      <ClientForm
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        client={client}
        onSubmit={handleFormSubmit}
      />

      {/* Deactivate Confirmation */}
      <AlertDialog open={isDeactivateOpen} onOpenChange={(open) => !open && !isDeactivating && setIsDeactivateOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{client.name}</strong> as inactive. You can reactivate them later from this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="detail-deactivate-reason">Reason for deactivation *</Label>
            <Textarea
              id="detail-deactivate-reason"
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
    </div>
  );
}
