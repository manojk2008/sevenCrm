"use client";

import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Mail, Phone, Globe, MapPin, FileText, Send, MoreHorizontal, Download, UploadCloud, Clock, Edit, CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, getInitials } from '@/lib/format';

export function ClientDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // Mock data for the view
  const client = {
    id,
    name: 'TechCorp India Pvt Ltd',
    industry: 'Technology',
    email: 'contact@techcorp.in',
    phone: '+91 9876543210',
    website: 'www.techcorp.in',
    gstNumber: '29ABCDE1234F1Z5',
    status: 'active',
    address: {
      line1: 'Tower B, 12th Floor, RMZ Infinity',
      line2: 'Old Madras Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560016',
      country: 'India'
    },
    metrics: {
      totalDeals: 12,
      totalRevenue: 2450000,
      openEnquiries: 3,
      lastActivity: '2 hours ago'
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      {/* Back & Breadcrumb */}
      <div>
        <Link href="/clients" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      {/* Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl shrink-0">
            {getInitials(client.name)}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <Badge variant="secondary" className="capitalize text-xs">{client.industry}</Badge>
              <Badge className={client.status === 'active' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                {client.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-3">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> {client.address.city}, {client.address.state}</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-gray-400" /> {client.website}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Send className="mr-2 h-4 w-4" /> Email
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>Create Enquiry</DropdownMenuItem>
              <DropdownMenuItem>Create Quotation</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">Delete Client</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Deals', value: client.metrics.totalDeals },
          { label: 'Total Revenue', value: formatCurrency(client.metrics.totalRevenue) },
          { label: 'Open Enquiries', value: client.metrics.openEnquiries },
          { label: 'Last Activity', value: client.metrics.lastActivity },
        ].map((metric, i) => (
          <Card key={i} className="rounded-2xl border-gray-100 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <p className="text-sm font-medium text-gray-500 mb-1">{metric.label}</p>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b border-gray-200 rounded-none bg-transparent h-12 p-0 gap-6 overflow-x-auto overflow-y-hidden">
          {['Overview', 'Contacts', 'Deals', 'Quotations', 'Documents', 'Timeline', 'Notes'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-gray-500">Email</div>
                    <div className="col-span-2 text-sm text-gray-900">{client.email}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-gray-500">Phone</div>
                    <div className="col-span-2 text-sm text-gray-900">{client.phone}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-gray-500">Website</div>
                    <div className="col-span-2 text-sm text-indigo-600 hover:underline cursor-pointer">{client.website}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-medium text-gray-500">GST Number</div>
                    <div className="col-span-2 text-sm text-gray-900 font-mono">{client.gstNumber}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-900 space-y-1">
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
            <Card className="rounded-2xl border-gray-100 shadow-sm">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Contacts</h3>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Contact</Button>
              </div>
              <div className="p-6 text-center text-gray-500">
                Contacts table will be displayed here.
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card className="rounded-2xl border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No deals yet</h3>
              <p className="text-sm text-gray-500 mb-4">This client doesn&apos;t have any active deals or enquiries.</p>
              <Button variant="outline">Create Deal</Button>
            </Card>
          </TabsContent>

          <TabsContent value="quotations">
            <Card className="rounded-2xl border-gray-100 shadow-sm p-12 text-center text-gray-500">
              No quotations available.
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-gray-50/50 transition-colors cursor-pointer">
                <UploadCloud className="w-10 h-10 text-indigo-500 mb-4" />
                <h3 className="text-base font-medium text-gray-900 mb-1">Upload Documents</h3>
                <p className="text-sm text-gray-500 mb-4">Drag and drop files here, or click to browse</p>
                <Button variant="outline" size="sm">Select Files</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <Card className="rounded-2xl border-gray-100 shadow-sm p-6">
              <div className="relative pl-6 space-y-6 border-l-2 border-gray-100 ml-3">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-500" />
                    <div className="text-sm font-medium text-gray-900 mb-1">Client created</div>
                    <div className="text-xs text-gray-500">Added by Manoj • {i + 1} days ago</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="rounded-2xl border-gray-100 shadow-sm p-6 text-center text-gray-500">
              Notes section here.
            </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
