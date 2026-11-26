"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RotateCw, TriangleAlert, type LucideIcon } from "lucide-react";

import type { Column } from "@/components/admin/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Fixed row height: the virtualizer positions rows arithmetically, so every row must be exactly this tall. */
export const ROW_HEIGHT = 48;
const OVERSCAN = 8;
const ACTIONS_WIDTH = "72px";

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
type Breakpoint = keyof typeof BREAKPOINTS;

/** Reads the column's existing responsive class ("hidden md:table-cell") so one Column definition serves both tables. */
function minBreakpoint(className?: string): Breakpoint | undefined {
  return className?.match(/hidden (sm|md|lg|xl):table-cell/)?.[1] as Breakpoint | undefined;
}

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

/** The widest breakpoint the viewport currently meets. Server snapshot: desktop layout. */
function useBreakpoint(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => BREAKPOINTS.xl,
  );
}

type VirtualTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  rowActions?: (row: T) => ReactNode;
  /** Optional row activation (click or Enter). */
  onRowClick?: (row: T) => void;
  /** Height of the scroll viewport. */
  viewportClassName?: string;
};

/**
 * Virtualized table for thousands of rows (@tanstack/react-virtual).
 *
 * Only the rows in view (+8 overscan each side) are in the DOM, positioned with
 * transform. It keeps real table semantics (<table>, aria-rowcount and
 * aria-rowindex for screen readers), a sticky header aligned with the body via
 * one shared grid template, hover tint, and keyboard navigation: Arrow keys,
 * Page Up/Down, Home/End move a roving focus and scroll the row into view.
 */
export function VirtualTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  rowActions,
  onRowClick,
  viewportClassName = "h-[min(70vh,720px)]",
}: VirtualTableProps<T>) {
  // TanStack Virtual returns one mutable instance whose output changes on
  // scroll; React Compiler's auto-memoisation would cache stale output.
  "use no memo";

  const scrollRef = useRef<HTMLDivElement>(null);
  // Mutable, render-free state for the scroll handler: pending frame id and last shadow state.
  const frameRef = useRef<number | undefined>(undefined);
  const scrolledRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const focusAfterScroll = useRef<number | null>(null);

  const width = useBreakpoint();
  const visibleColumns = columns.filter((column) => {
    const bp = minBreakpoint(column.className);
    return !bp || width >= BREAKPOINTS[bp];
  });
  const template = [...visibleColumns.map((c) => c.width ?? "minmax(0,1fr)"), ...(rowActions ? [ACTIONS_WIDTH] : [])].join(" ");
  const count = rows?.length ?? 0;

  // The component opts out of compiler memoisation ("use no memo" above), which is the fix this rule asks for.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => rows?.[index]?.id ?? index,
  });

  // Header shadow when the body is scrolled. Scroll fires many times per
  // frame; the work is batched to one requestAnimationFrame and written
  // straight to a data attribute, so scrolling never re-renders React.
  const onScroll = () => {
    if (frameRef.current !== undefined) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      const el = scrollRef.current;
      if (!el) return;
      const scrolled = el.scrollTop > 0;
      if (scrolled !== scrolledRef.current) {
        scrolledRef.current = scrolled;
        el.dataset.scrolled = scrolled ? "true" : "false";
      }
    });
  };
  useEffect(() => () => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
  }, []);

  // After keyboard navigation scrolls a row into view, move focus onto it.
  useEffect(() => {
    const index = focusAfterScroll.current;
    if (index === null) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`tr[data-index="${index}"]`);
    if (row) {
      focusAfterScroll.current = null;
      row.focus({ preventScroll: true });
    }
  });

  const safeActive = Math.min(activeIndex, Math.max(0, count - 1));

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(count - 1, index));
    setActiveIndex(next);
    focusAfterScroll.current = next;
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    // Let row action buttons and menus keep their own keys.
    if ((event.target as HTMLElement).tagName !== "TR") return;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? ROW_HEIGHT * 10) / ROW_HEIGHT) - 1);
    const keys: Record<string, number> = { ArrowDown: safeActive + 1, ArrowUp: safeActive - 1, PageDown: safeActive + page, PageUp: safeActive - page, Home: 0, End: count - 1 };
    if (event.key in keys) {
      event.preventDefault();
      moveTo(keys[event.key]);
    } else if (event.key === "Enter" && onRowClick && rows?.[safeActive]) {
      event.preventDefault();
      onRowClick(rows[safeActive]);
    }
  };

  if (isError) {
    return (
      <div role="alert" className="bg-destructive/10 flex flex-col items-start gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-destructive flex items-center gap-2 text-sm">
          <TriangleAlert className="size-4" aria-hidden="true" />
          {errorMessage ?? "This list could not be loaded."}
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isLoading && count === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div className="bg-card shadow-card overflow-hidden rounded-2xl border">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-scrolled="false"
        className={cn("group/vt relative overflow-auto overscroll-contain", viewportClassName)}
      >
        <table className="grid w-full text-sm" aria-rowcount={count + 1} aria-busy={isLoading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-muted sticky top-0 z-10 grid transition-shadow group-data-[scrolled=true]/vt:shadow-[0_1px_0_var(--border-color),0_6px_12px_-8px_rgba(28,25,23,0.18)]">
            <tr className="grid h-12 border-b" style={{ gridTemplateColumns: template }} aria-rowindex={1}>
              {visibleColumns.map((column) => (
                <th key={column.id} scope="col" className="text-foreground flex items-center px-3 text-left text-[13px] font-medium whitespace-nowrap">
                  {column.header}
                </th>
              ))}
              {rowActions ? (
                <th scope="col" className="text-foreground flex items-center justify-end px-3 text-[13px] font-medium">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          {isLoading && count === 0 ? (
            <tbody className="grid">
              {Array.from({ length: 10 }, (_, index) => (
                <tr key={index} className="grid h-12 items-center border-b" style={{ gridTemplateColumns: template }}>
                  {visibleColumns.map((column) => (
                    <td key={column.id} className="px-3">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                  {rowActions ? <td className="px-3" /> : null}
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody className="relative grid" style={{ height: virtualizer.getTotalSize() }} onKeyDown={onKeyDown}>
              {items.map((item) => {
                const row = rows![item.index];
                return (
                  <tr
                    key={item.key}
                    data-index={item.index}
                    aria-rowindex={item.index + 2}
                    tabIndex={item.index === safeActive ? 0 : -1}
                    onFocus={(event) => event.target === event.currentTarget && setActiveIndex(item.index)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-ring/40 absolute inset-x-0 top-0 grid items-center border-b outline-none focus-visible:ring-2 focus-visible:ring-inset",
                      onRowClick && "cursor-pointer",
                    )}
                    style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="min-w-0 truncate px-3">
                        {column.cell(row)}
                      </td>
                    ))}
                    {rowActions ? <td className="flex justify-end px-3">{rowActions(row)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
