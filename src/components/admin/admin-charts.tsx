"use client";

import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CourseOffering } from "@/types/entities";

/*
 * Entry animations are off: each animated frame is a React commit (the
 * profiler counted ~110 extra commits and ~2,000 component renders per /admin
 * load), and they delay the moment the chart is readable.
 *
 * Colours are literal hex per theme: SVG presentation attributes do not
 * resolve CSS variables reliably. The categorical set (roles) passed the
 * dataviz palette validator in both modes (lightness band, chroma floor,
 * CVD and normal-vision separation, 3:1 against the card surface):
 *   light #15803d / #2563eb / #be185d on #ffffff
 *   dark  #10b981 / #3b82f6 / #ec4899 on #1c1c1e
 * Text never wears a series colour; legends and ticks use the text tokens.
 */
const PALETTE = {
  light: {
    surface: "#ffffff",
    text: "#1c1917",
    muted: "#78716c",
    grid: "#e7e1d8",
    roles: { ADMIN: "#15803d", FACULTY: "#2563eb", STUDENT: "#be185d" },
    enrolled: "#15803d",
    free: "#d6d3d1",
  },
  dark: {
    surface: "#1c1c1e",
    text: "#e4e4e7",
    muted: "#a1a1aa",
    grid: "#2e2e32",
    roles: { ADMIN: "#10b981", FACULTY: "#3b82f6", STUDENT: "#ec4899" },
    enrolled: "#34d399",
    free: "#3f3f46",
  },
} as const;

type Role = "ADMIN" | "FACULTY" | "STUDENT";
const ROLE_ORDER: Role[] = ["ADMIN", "FACULTY", "STUDENT"];

function usePalette() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? PALETTE.dark : PALETTE.light;
}

/** Fixed height shared with the loading skeleton so the swap causes no layout shift. */
export const CHART_HEIGHT_CLASS = "h-64";

function tooltipStyle(p: (typeof PALETTE)["light" | "dark"]) {
  return {
    contentStyle: { background: p.surface, border: `1px solid ${p.grid}`, borderRadius: 10, color: p.text, fontSize: 13 },
    itemStyle: { color: p.text },
    labelStyle: { color: p.muted },
  };
}

function legendText(color: string) {
  return function LegendLabel(value: string) {
    return <span style={{ color }}>{value}</span>;
  };
}

export function RolesDonut({ byRole }: { byRole: Record<Role, number> }) {
  const p = usePalette();
  const data = ROLE_ORDER.map((role) => ({
    name: role.charAt(0) + role.slice(1).toLowerCase(),
    value: byRole[role],
    role,
  }));

  return (
    <div role="img" aria-label={`Accounts by role: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`} className={`${CHART_HEIGHT_CLASS} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={0} stroke={p.surface} strokeWidth={2} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.role} fill={p.roles[entry.role]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle(p)} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" iconSize={10} formatter={legendText(p.text)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Enrolled vs. free seats for the eight largest offerings. */
export function SeatBars() {
  const p = usePalette();
  const query = { limit: 8, sortBy: "maxSeats", sortOrder: "desc" as const };
  const offerings = useApiQuery({
    queryKey: queryKeys.courseOfferings.list(query),
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", query),
  });

  const data = (offerings.data?.data ?? []).map((offering) => ({
    name: offering.course.courseCode,
    enrolled: offering.enrolledCount,
    free: Math.max(0, offering.seatsRemaining),
  }));

  if (offerings.isPending) return <div className={`skeleton-shimmer ${CHART_HEIGHT_CLASS} w-full rounded-xl`} aria-hidden="true" />;
  if (data.length === 0) return <p className={`text-muted-foreground flex ${CHART_HEIGHT_CLASS} items-center justify-center text-sm`}>No offerings yet.</p>;

  return (
    <div role="img" aria-label={`Seat use for ${data.length} offerings`} className={`${CHART_HEIGHT_CLASS} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={p.grid} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: p.muted }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: p.muted }} />
          <Tooltip cursor={{ fill: p.grid, fillOpacity: 0.5 }} {...tooltipStyle(p)} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" iconSize={10} formatter={legendText(p.text)} />
          <Bar dataKey="enrolled" name="Enrolled" stackId="seats" fill={p.enrolled} stroke={p.surface} strokeWidth={2} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="free" name="Free seats" stackId="seats" fill={p.free} stroke={p.surface} strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
