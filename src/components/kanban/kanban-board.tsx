"use client";

import { useState, useRef } from "react";
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
  /**
   * Fired once, on drop, when a card actually ended up in a different column
   * than it started in. The board has already applied the move optimistically
   * by this point; the parent persists it and is responsible for rolling back
   * to `previousStage` if the request fails.
   *
   * In-column reordering never fires this: the backend has no ordering field,
   * so that reorder is presentational only and is not persisted.
   */
  onStageChange?: (enquiryId: string, newStage: Enquiry["stage"], previousStage: Enquiry["stage"]) => void;
}

export function KanbanBoard({ enquiries, setEnquiries, onCardClick, onStageChange }: KanbanBoardProps) {
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);
  // Captured at drag start so the drop handler can tell a genuine column
  // change from a same-column reorder, and hand the parent a stage to roll
  // back to.
  const dragOriginStage = useRef<Enquiry["stage"] | null>(null);

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
    if (enquiry) {
      setActiveEnquiry(enquiry);
      dragOriginStage.current = enquiry.stage;
    }
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
      const activeIndex = enquiries.findIndex((t) => t.id === activeId);
      const overIndex = enquiries.findIndex((t) => t.id === overId);
      if (activeIndex === -1 || overIndex === -1) return;

      const activeTask = enquiries[activeIndex];
      const overTask = enquiries[overIndex];

      const updated =
        activeTask.stage !== overTask.stage
          ? enquiries.map((t) => (t.id === activeId ? { ...t, stage: overTask.stage } : t))
          : enquiries;

      setEnquiries(arrayMove(updated, activeIndex, overIndex));
    }

    // Dropping a Task over a Column
    if (isActiveTask && isOverColumn) {
      const activeIndex = enquiries.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return;

      const activeTask = enquiries[activeIndex];
      const newStage = overId as Enquiry["stage"];

      if (activeTask.stage !== newStage) {
        const updated = enquiries.map((t) =>
          t.id === activeId ? { ...t, stage: newStage } : t
        );
        setEnquiries(updated);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEnquiry(null);
    const { active, over } = event;

    const originStage = dragOriginStage.current;
    dragOriginStage.current = null;

    const activeId = active.id;
    const activeIndex = enquiries.findIndex((t) => t.id === activeId);

    // Persist a genuine column change even when the pointer was released
    // outside a droppable (`over` is null) — handleDragOver has already moved
    // the card by then, so returning early here would leave the UI showing a
    // stage the server never heard about.
    const settledStage = activeIndex !== -1 ? enquiries[activeIndex].stage : null;
    if (originStage && settledStage && settledStage !== originStage) {
      onStageChange?.(String(activeId), settledStage, originStage);
    }

    if (!over) return;

    const overId = over.id;
    if (activeId === overId) return;

    // Final sorting if within the same column. Visual only — the backend has
    // no ordering field, so this is deliberately not persisted.
    const overIndex = enquiries.findIndex((t) => t.id === overId);

    if (
      activeIndex !== -1 &&
      overIndex !== -1 &&
      enquiries[activeIndex].stage === enquiries[overIndex].stage
    ) {
      setEnquiries(arrayMove(enquiries, activeIndex, overIndex));
    }
  };

  return (
    <div className="scrollbar-thin flex w-full overflow-x-auto overflow-y-hidden rounded-xl bg-muted/40">
      <div className="flex min-w-max gap-4 p-4">
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