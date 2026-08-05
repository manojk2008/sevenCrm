"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Enquiry, ENQUIRY_STAGES } from "@/types/enquiry";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";

interface KanbanBoardProps {
  enquiries: Enquiry[];
  setEnquiries: (enquiries: Enquiry[]) => void;
  onCardClick: (enquiry: Enquiry) => void;
}

export function KanbanBoard({ enquiries, setEnquiries, onCardClick }: KanbanBoardProps) {
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);

  const columns = ENQUIRY_STAGES.map((stage) => stage.key);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const enquiry = enquiries.find((e) => e.id === active.id);
    if (enquiry) setActiveEnquiry(enquiry);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    // Dropping a Task over another Task
    if (isActiveTask && isOverTask) {
      setEnquiries((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        const activeTask = tasks[activeIndex];
        const overTask = tasks[overIndex];

        if (activeTask.stage !== overTask.stage) {
          activeTask.stage = overTask.stage;
          return arrayMove(tasks, activeIndex, overIndex);
        }

        return arrayMove(tasks, activeIndex, overIndex);
      });
    }

    // Dropping a Task over a Column
    if (isActiveTask && isOverColumn) {
      setEnquiries((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const activeTask = tasks[activeIndex];
        const newStage = overId as Enquiry["stage"];
        
        if (activeTask.stage !== newStage) {
          activeTask.stage = newStage;
          return arrayMove(tasks, activeIndex, activeIndex);
        }
        return tasks;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEnquiry(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Final sorting if within the same column
    setEnquiries((tasks) => {
      const activeIndex = tasks.findIndex((t) => t.id === activeId);
      const overIndex = tasks.findIndex((t) => t.id === overId);
      if (activeIndex !== -1 && overIndex !== -1 && tasks[activeIndex].stage === tasks[overIndex].stage) {
         return arrayMove(tasks, activeIndex, overIndex);
      }
      return tasks;
    });
  };

  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden bg-slate-50/50 dark:bg-slate-900/50 flex">
      <div className="flex h-full p-4 gap-4 min-w-max">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {ENQUIRY_STAGES.map((stage) => {
            const stageEnquiries = enquiries.filter((e) => e.stage === stage.key);
            return (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                enquiries={stageEnquiries}
                onCardClick={onCardClick}
              />
            );
          })}

          <DragOverlay>
            {activeEnquiry ? (
              <KanbanCard
                enquiry={activeEnquiry}
                onClick={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
