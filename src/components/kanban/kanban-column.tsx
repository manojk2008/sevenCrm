"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Enquiry, EnquiryStageInfo } from "@/types/enquiry";
import { KanbanCard } from "./kanban-card";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";

interface KanbanColumnProps {
  stage: EnquiryStageInfo;
  enquiries: Enquiry[];
  onCardClick: (enquiry: Enquiry) => void;
}

export function KanbanColumn({ stage, enquiries, onCardClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.key,
    data: {
      type: "Column",
      stage,
    },
  });

  const totalValue = useMemo(() => {
    return enquiries.reduce((sum, e) => sum + (e.expectedRevenue || 0), 0);
  }, [enquiries]);

  const taskIds = useMemo(() => {
    return enquiries.map((e) => e.id);
  }, [enquiries]);

  return (
    <div className="flex h-[calc(100vh-22rem)] min-h-[24rem] w-[320px] max-w-[320px] flex-shrink-0 flex-col overflow-hidden rounded-xl border bg-card">
      {/* Column Header */}
      <div className={`px-4 py-3 border-b flex flex-col gap-1 ${stage.bgColor} bg-opacity-30 dark:bg-opacity-20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-sm ${stage.color}`}>{stage.label}</h3>
            <span className="bg-white dark:bg-slate-800 text-xs text-slate-500 px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              {enquiries.length}
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {formatCurrency(totalValue)}
        </div>
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin flex flex-col gap-2 relative">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="flex-1 flex flex-col gap-2 min-h-[150px]">
            {enquiries.map((enquiry) => (
              <KanbanCard key={enquiry.id} enquiry={enquiry} onClick={() => onCardClick(enquiry)} />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add Button */}
      <div className="p-2 pt-0 mt-auto">
        <button className="w-full py-2 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
}
