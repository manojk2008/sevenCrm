"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Enquiry, ENQUIRY_STAGES } from "@/types/enquiry";
import type { EnquiryStage } from "@/types/enquiry";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Calendar, User, Building, MapPin, DollarSign, Target, Activity, Package } from "lucide-react";

interface EnquiryDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiry: Enquiry | null;
  onEdit?: (enquiry: Enquiry) => void;
  /** Moves the enquiry to a new stage; the parent owns the LOST-reason flow. */
  onStageChange?: (stage: EnquiryStage) => void;
}

export function EnquiryDetail({ open, onOpenChange, enquiry, onEdit, onStageChange }: EnquiryDetailProps) {
  if (!enquiry) return null;

  const stageIndex = ENQUIRY_STAGES.findIndex(s => s.key === enquiry.stage);
  const currentStageInfo = ENQUIRY_STAGES[stageIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto p-0 sm:max-w-2xl">
        <div className="flex flex-col">
          {/* Header Section */}
          <div className="sticky top-0 z-10 border-b bg-card p-6 pr-14 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`${currentStageInfo?.color} ${currentStageInfo?.bgColor} ${currentStageInfo?.borderColor}`}>
                    {currentStageInfo?.label}
                  </Badge>
                  <Badge variant="secondary" className="uppercase text-[11px]">
                    {enquiry.priority} Priority
                  </Badge>
                </div>
                <DialogTitle className="text-xl md:text-2xl font-bold">{enquiry.title}</DialogTitle>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  <Building className="h-4 w-4" />
                  {enquiry.clientCompany || enquiry.clientName}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit?.(enquiry)}>Edit</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        Actions
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Change Stage</DropdownMenuLabel>
                    {ENQUIRY_STAGES.filter((s) => s.key !== enquiry.stage).map((s) => (
                      <DropdownMenuItem
                        key={s.key}
                        className={s.key === "lost" ? "text-destructive" : undefined}
                        onClick={() => onStageChange?.(s.key)}
                      >
                        {s.key === "won" ? "Mark as Won" : s.key === "lost" ? "Mark as Lost" : `Move to ${s.label}`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Pipeline Stepper */}
            <div className="mt-6 flex items-center w-full">
              {ENQUIRY_STAGES.map((stage, idx) => {
                const isCompleted = idx < stageIndex;
                const isCurrent = idx === stageIndex;

                return (
                  <div key={stage.key} className="flex-1 flex flex-col relative group">
                    {/* Line connector */}
                    {idx !== 0 && (
                      <div className={`absolute left-0 top-3 h-0.5 w-full -translate-x-1/2 -z-10 transition-colors ${
                        isCompleted || isCurrent ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`} />
                    )}

                    <div className="flex flex-col items-center gap-2 cursor-pointer z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 bg-card transition-colors ${
                        isCompleted ? 'border-indigo-600 text-indigo-600' :
                        isCurrent ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700' :
                        'border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}>
                        {isCompleted ? <Check className="h-3 w-3" /> : (idx + 1)}
                      </div>
                      <span className={`text-[11px] font-medium text-center leading-tight px-1 ${
                        isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500'
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6">
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 bg-card p-4 rounded-xl border shadow-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3"/> Expected Revenue</p>
                <p className="font-semibold text-foreground">{formatCurrency(enquiry.expectedRevenue || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Target className="h-3 w-3"/> Probability</p>
                <p className="font-semibold text-foreground">{enquiry.probability || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3"/> Source</p>
                <p className="font-semibold text-foreground capitalize">{enquiry.source}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><User className="h-3 w-3"/> Executive</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-muted text-[11px] flex items-center justify-center font-bold">
                    {enquiry.assignedToName ? enquiry.assignedToName.charAt(0) : "—"}
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    {enquiry.assignedToName || "Unassigned"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/> Expected Close</p>
                <p className="font-semibold text-foreground text-sm">
                  {enquiry.expectedCloseDate ? format(new Date(enquiry.expectedCloseDate), "MMM d, yyyy") : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Activity className="h-3 w-3"/> Created</p>
                <p className="font-semibold text-foreground text-sm">
                  {enquiry.createdAt ? format(new Date(enquiry.createdAt), "MMM d, yyyy") : "Unknown"}
                </p>
              </div>
            </div>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full grid grid-cols-4 bg-muted p-1 rounded-lg">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>

              <div className="mt-6 bg-card border rounded-xl p-5 shadow-sm min-h-[300px]">
                <TabsContent value="details" className="mt-0">
                  <h4 className="font-semibold mb-3">Description</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {enquiry.description || "No description provided."}
                  </p>

                  {/* Real attached Products, resolved by the API from the
                      EnquiryProduct join — name, group, price and status all
                      come from the live Product record. An inactive one is
                      still listed (it stays attached until deliberately
                      removed) and is marked as such rather than hidden. */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">Products</h4>
                    {enquiry.products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No products are attached to this enquiry.
                      </p>
                    ) : (
                      <ul className="divide-y rounded-lg border">
                        {enquiry.products.map((product) => (
                          <li
                            key={product.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate text-sm font-medium">{product.name}</span>
                                {product.status === "inactive" && (
                                  <Badge variant="warning" className="shrink-0">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 truncate pl-5 text-xs text-slate-500">
                                {product.productGroup.name}
                                {product.sku ? ` · ${product.sku}` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold tabular-nums">
                                {formatCurrency(product.price)}
                              </p>
                              {product.unit && (
                                <p className="text-xs text-slate-500">per {product.unit}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                {/* Timeline / Notes history / Files have no backend yet (not
                    part of the Enquiries API) — they stay placeholders rather
                    than showing invented activity. */}
                <TabsContent value="timeline" className="mt-0">
                  <div className="text-center text-muted-foreground text-sm py-10">
                    <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    Activity timeline isn&apos;t available yet.
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                   <div className="text-center text-muted-foreground text-sm py-10">
                     Notes history isn&apos;t available yet.
                   </div>
                </TabsContent>

                <TabsContent value="files" className="mt-0">
                   <div className="text-center text-muted-foreground text-sm py-10">
                     File attachments aren&apos;t available yet.
                   </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
