"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { VirtualTable as VirtualTableType } from "./virtual-table";

/**
 * Same box as the loaded table (card, 48px header, h-[min(70vh,720px)]
 * viewport), so swapping it in shifts nothing.
 */
function VirtualTableSkeleton() {
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-2xl border" role="status" aria-label="Loading list">
      <div className="bg-surface-muted h-12 border-b" />
      <div className="h-[min(70vh,720px)] space-y-0">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex h-12 items-center border-b px-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The virtualized table and @tanstack/react-virtual are only needed in the
 * "All records" view, so they are a separate chunk the paged view never loads.
 */
export const VirtualTable = dynamic(() => import("./virtual-table").then((m) => m.VirtualTable), {
  loading: VirtualTableSkeleton,
}) as typeof VirtualTableType;
