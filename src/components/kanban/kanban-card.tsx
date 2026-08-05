"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Enquiry } from "@/types/enquiry";
import { formatCurrency } from "@/lib/utils";
import { GripVertical, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface KanbanCardProps {
  enquiry: Enquiry;
  onClick: () => void;
  isOverlay?: boolean;
}

const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export function KanbanCard({ enquiry, onClick, isOverlay }: KanbanCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: enquiry.id,
    data: {
      type: "Task",
      enquiry,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-full rounded-xl h-[160px] border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 opacity-50"
      />
    );
  }

  const priorityKey = (enquiry.priority?.toLowerCase() || "medium") as keyof typeof PRIORITY_COLORS;
  const pColor = PRIORITY_COLORS[priorityKey] || PRIORITY_COLORS.medium;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative ${
        isOverlay ? "rotate-2 scale-105 shadow-xl ring-2 ring-indigo-500" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {enquiry.clientCompany || enquiry.clientName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{enquiry.title}</p>
        </div>
        
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab p-1 -mr-2 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider ${pColor}`}>
          {enquiry.priority}
        </span>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {formatCurrency(enquiry.expectedRevenue || 0)}
        </span>
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-3">
        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${enquiry.probability || 0}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
            {enquiry.assignedToName?.charAt(0) || "U"}
          </div>
          <span className="truncate max-w-[80px]">{enquiry.assignedToName?.split(" ")[0]}</span>
        </div>
        
        {enquiry.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(enquiry.expectedCloseDate), "MMM d")}</span>
          </div>
        )}
      </div>
      
      {/* Activity dot indicator - Mock logic */}
      <div className="absolute top-3 right-8 w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Recent activity" />
    </div>
  );
}
