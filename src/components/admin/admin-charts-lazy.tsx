"use client";

import dynamic from "next/dynamic";

/**
 * Client islands for the two charts. Recharts is the heaviest client
 * dependency, so it is split out and fetched after the page shell. Both
 * fallbacks have the chart's exact height (h-64), so nothing shifts when the
 * real chart replaces them.
 */
function ChartSkeleton() {
  return <div className="skeleton-shimmer h-64 w-full rounded-xl" aria-hidden="true" />;
}

export const RolesDonut = dynamic(() => import("./admin-charts").then((m) => m.RolesDonut), { ssr: false, loading: ChartSkeleton });
export const SeatBars = dynamic(() => import("./admin-charts").then((m) => m.SeatBars), { ssr: false, loading: ChartSkeleton });
