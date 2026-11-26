import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Tone only tints the icon and the chip. The card itself stays calm; the
 * accent is used sparingly, for the chip of a normal figure. Full class names
 * (not template strings) so Tailwind can see them.
 */
const toneStyles = {
  indigo: { icon: "text-muted-foreground", chip: "bg-brand-soft text-accent-foreground" },
  violet: { icon: "text-muted-foreground", chip: "bg-brand-soft text-accent-foreground" },
  teal: { icon: "text-muted-foreground", chip: "bg-brand-soft text-accent-foreground" },
  sky: { icon: "text-muted-foreground", chip: "bg-brand-soft text-accent-foreground" },
  amber: { icon: "text-warning", chip: "bg-warning/12 text-warning" },
  rose: { icon: "text-destructive", chip: "bg-destructive/10 text-destructive" },
} as const;

export type StatTone = keyof typeof toneStyles;

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
  className?: string;
};

/**
 * Card shell shared by the real card and its skeleton. The fixed min-height
 * means the skeleton and the loaded card occupy exactly the same box (CLS 0).
 */
const SHELL = "card-hover min-h-[152px] justify-between gap-4 px-4 sm:px-6";

/** Label -> large value -> chip. A Server Component: no client JavaScript. */
export function StatCard({ label, value, hint, icon: Icon, tone = "indigo", className }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <Card className={cn(SHELL, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground truncate text-[13px] font-medium tracking-wide uppercase">{label}</p>
        <Icon className={cn("size-5 shrink-0", styles.icon)} aria-hidden="true" />
      </div>
      <p className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums sm:text-[32px]">{value}</p>
      <div className="h-6">
        {hint ? (
          <span className={cn("inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-xs font-medium", styles.chip)}>{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(SHELL, className)} aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-5 rounded-md" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-6 w-36 rounded-full" />
    </Card>
  );
}
