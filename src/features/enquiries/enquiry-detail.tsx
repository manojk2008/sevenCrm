"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Enquiry, ENQUIRY_STAGES } from "@/types/enquiry";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Calendar, User, Building, MapPin, DollarSign, Target, Activity } from "lucide-react";

interface EnquiryDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiry: Enquiry | null;
}

export function EnquiryDetail({ open, onOpenChange, enquiry }: EnquiryDetailProps) {
  if (!enquiry) return null;

  const stageIndex = ENQUIRY_STAGES.findIndex(s => s.key === enquiry.stage);
  const currentStageInfo = ENQUIRY_STAGES[stageIndex];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden border-l border-slate-200 dark:border-slate-800">
        {/* Header Section */}
        <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 flex-shrink-0 shadow-sm relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`${currentStageInfo?.color} ${currentStageInfo?.bgColor} ${currentStageInfo?.borderColor}`}>
                  {currentStageInfo?.label}
                </Badge>
                <Badge variant="secondary" className="uppercase text-[10px]">
                  {enquiry.priority} Priority
                </Badge>
              </div>
              <SheetTitle className="text-xl md:text-2xl font-bold">{enquiry.title}</SheetTitle>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                <Building className="h-4 w-4" />
                {enquiry.clientCompany || enquiry.clientName}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700">Actions</Button>
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
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 bg-white dark:bg-slate-900 transition-colors ${
                      isCompleted ? 'border-indigo-600 text-indigo-600' : 
                      isCurrent ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700' : 
                      'border-slate-200 dark:border-slate-700 text-slate-400'
                    }`}>
                      {isCompleted ? <Check className="h-3 w-3" /> : (idx + 1)}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight px-1 ${
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
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3"/> Expected Revenue</p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(enquiry.expectedRevenue || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Target className="h-3 w-3"/> Probability</p>
                <p className="font-semibold text-slate-900 dark:text-white">{enquiry.probability || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3"/> Source</p>
                <p className="font-semibold text-slate-900 dark:text-white capitalize">{enquiry.source}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><User className="h-3 w-3"/> Executive</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] flex items-center justify-center font-bold">
                    {enquiry.assignedToName?.charAt(0)}
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{enquiry.assignedToName}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/> Expected Close</p>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {enquiry.expectedCloseDate ? format(new Date(enquiry.expectedCloseDate), "MMM d, yyyy") : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Activity className="h-3 w-3"/> Created</p>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {enquiry.createdAt ? format(new Date(enquiry.createdAt), "MMM d, yyyy") : "Unknown"}
                </p>
              </div>
            </div>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full grid grid-cols-4 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
              
              <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm min-h-[300px]">
                <TabsContent value="details" className="mt-0">
                  <h4 className="font-semibold mb-3">Description</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {enquiry.description || "No description provided."}
                  </p>
                  
                  {enquiry.products && enquiry.products.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-3">Products Interested</h4>
                      <div className="flex flex-wrap gap-2">
                        {enquiry.products.map(p => (
                          <Badge key={p} variant="secondary">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="timeline" className="mt-0">
                  <div className="text-center text-slate-500 text-sm py-10">
                    <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    Timeline integration pending mock data structure
                  </div>
                </TabsContent>
                
                <TabsContent value="notes" className="mt-0">
                   <div className="text-center text-slate-500 text-sm py-10">Notes implementation here</div>
                </TabsContent>
                
                <TabsContent value="files" className="mt-0">
                   <div className="text-center text-slate-500 text-sm py-10">File uploads here</div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
