import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <div className="rounded-md border">
        <div className="h-12 border-b bg-muted/50 px-4 flex items-center space-x-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 border-b px-4 flex items-center space-x-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-8 ml-auto rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4">
        <Skeleton className="h-4 w-[200px]" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-8 w-[100px]" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-2 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm w-full h-[350px] flex flex-col">
      <Skeleton className="h-6 w-[200px] mb-6" />
      <Skeleton className="flex-1 w-full" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-2xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Skeleton className="h-10 w-[100px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-8 w-[120px]" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-4 w-[60px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 w-full h-full overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 min-w-[300px] w-[300px] rounded-xl bg-muted/30 p-4">
          <Skeleton className="h-6 w-1/2 mb-2" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
