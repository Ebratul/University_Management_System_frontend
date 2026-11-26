"use client";

import type { ListDataset, ListView } from "@/hooks/use-list-state";
import { SAMPLE_SIZE_LABEL } from "@/components/admin/sample-size";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="bg-surface-muted inline-flex h-10 items-center gap-1 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-visible:ring-ring/40 h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
            value === option.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Paged (server pagination) vs. All records (every row in one virtualized
 * list). In the all view, the data source can be switched to a generated
 * sample to see how the list behaves with thousands of rows.
 */
export function ListViewSwitch({
  view,
  dataset,
  onChange,
}: {
  view: ListView;
  dataset: ListDataset;
  onChange: (changes: { view?: ListView | undefined; dataset?: ListDataset | undefined }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="List view"
        value={view}
        options={[
          { value: "paged", label: "Paged" },
          { value: "all", label: "All records" },
        ]}
        onChange={(next) => onChange(next === "all" ? { view: "all" } : { view: undefined, dataset: undefined })}
      />
      {view === "all" ? (
        <Segmented
          label="Data source"
          value={dataset}
          options={[
            { value: "live", label: "Live data" },
            { value: "sample", label: `Sample (${SAMPLE_SIZE_LABEL})` },
          ]}
          onChange={(next) => onChange({ dataset: next === "sample" ? "sample" : undefined })}
        />
      ) : null}
    </div>
  );
}
