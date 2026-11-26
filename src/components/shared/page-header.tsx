import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  /** One word of the title to set in the accent colour, e.g. "Overview". */
  highlight?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

function renderTitle(title: string, highlight?: string) {
  if (!highlight) return title;
  const index = title.indexOf(highlight);
  if (index === -1) return title;
  return (
    <>
      {title.slice(0, index)}
      <span className="text-primary italic">{highlight}</span>
      {title.slice(index + highlight.length)}
    </>
  );
}

/** Page title block. A Server Component: no client JavaScript. */
export function PageHeader({ eyebrow, title, highlight, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-3">
        {eyebrow ? <p className="text-primary text-[13px] font-semibold tracking-wider uppercase">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl lg:text-[40px]">{renderTitle(title, highlight)}</h1>
        {description ? <p className="text-muted-foreground max-w-2xl text-base text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
