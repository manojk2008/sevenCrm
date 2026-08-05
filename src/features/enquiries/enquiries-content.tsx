"use client";

import { useState } from "react";
import { Plus, LayoutGrid, Table as TableIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { EnquiryForm } from "./enquiry-form";
import { EnquiryDetail } from "./enquiry-detail";
import { Enquiry, ENQUIRY_STAGES } from "@/types/enquiry";
import { formatCurrency } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Use a mock payload matching the required type until data layer is fully hooked up
import { mockEnquiries } from "./mock-data";

export function EnquiriesContent() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);

  const [enquiries, setEnquiries] = useState<Enquiry[]>(mockEnquiries);

  const handleEnquiryClick = (enquiry: Enquiry) => {
    setSelectedEnquiryId(enquiry.id);
  };

  const selectedEnquiry = enquiries.find((e) => e.id === selectedEnquiryId) || null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0 z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Enquiries</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your sales pipeline</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")} className="mr-2">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="kanban" className="text-xs px-3">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs px-3">
                <TableIcon className="h-4 w-4 mr-2" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by Stage</DropdownMenuLabel>
              {ENQUIRY_STAGES.map((s) => (
                <DropdownMenuItem key={s.key}>{s.label}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
              <DropdownMenuItem>Urgent</DropdownMenuItem>
              <DropdownMenuItem>High</DropdownMenuItem>
              <DropdownMenuItem>Medium</DropdownMenuItem>
              <DropdownMenuItem>Low</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setIsFormOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Enquiry
          </Button>
        </div>
      </div>

      {/* Tabs / Sub-filters */}
      <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 flex items-center gap-6 text-sm font-medium flex-shrink-0">
        <button className="text-indigo-600 border-b-2 border-indigo-600 pb-2 -mb-[9px]">All</button>
        <button className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 pb-2 -mb-[9px]">My Enquiries</button>
        <button className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 pb-2 -mb-[9px]">Unassigned</button>
        <button className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 pb-2 -mb-[9px]">Overdue</button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {view === "kanban" ? (
          <KanbanBoard enquiries={enquiries} setEnquiries={setEnquiries} onCardClick={handleEnquiryClick} />
        ) : (
          <div className="p-6 overflow-auto h-full">
            <div className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    <th className="px-4 py-3 font-medium text-center">Probability</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Executive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {enquiries.map((eq) => {
                    const stageInfo = ENQUIRY_STAGES.find((s) => s.key === eq.stage);
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => handleEnquiryClick(eq)}>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{eq.title}</td>
                        <td className="px-4 py-3 text-slate-500">{eq.clientName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageInfo?.bgColor} ${stageInfo?.color}`}>
                            {stageInfo?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(eq.expectedRevenue || 0)}</td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${eq.probability}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{eq.priority}</span>
                        </td>
                        <td className="px-4 py-3 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                            {eq.assignedToName?.charAt(0) || "U"}
                          </div>
                          <span className="text-xs truncate max-w-[100px]">{eq.assignedToName}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedEnquiry && (
        <EnquiryDetail
          open={!!selectedEnquiryId}
          onOpenChange={(open) => !open && setSelectedEnquiryId(null)}
          enquiry={selectedEnquiry}
        />
      )}

      {isFormOpen && (
        <EnquiryForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
        />
      )}
    </div>
  );
}
