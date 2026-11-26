import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for a lazily loaded dialog form. Each row matches a form field
 * (label + 40px control, 20px apart) and the footer matches the buttons, so the
 * dialog keeps its size when the real form arrives.
 */
export function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Loading form">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
