"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Client island: re-runs the Server Component data fetch without a full reload. */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="font-medium underline underline-offset-4 disabled:opacity-60"
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying…" : "Try again"}
    </button>
  );
}
