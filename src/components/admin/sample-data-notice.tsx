import { FlaskConical } from "lucide-react";

/** Makes it impossible to mistake generated rows for real records. */
export function SampleDataNotice({ onExit }: { onExit: () => void }) {
  return (
    <div role="note" className="border-warning/40 bg-warning/10 text-foreground flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
      <FlaskConical className="text-warning size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Sample data.</span> These rows are generated in your browser to test large lists. They are not saved, and actions are turned off.
      </p>
      <button type="button" onClick={onExit} className="focus-visible:ring-ring/40 rounded-md font-medium underline underline-offset-4 outline-none focus-visible:ring-2">
        Show live data
      </button>
    </div>
  );
}
