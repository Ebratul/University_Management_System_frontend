"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { INPUT_DEBOUNCE_MS, useDebouncedCallback } from "@/hooks/use-debounce";

/**
 * Two-way binding between a piece of UI state and a URL query parameter.
 *
 * The value updates instantly in local state, so typing is never held up by
 * navigation. The URL follows after `debounceMs` (useDebouncedCallback), so
 * filters survive a refresh and can be shared as links, and the list behind
 * the input re-renders once per pause instead of once per keystroke.
 * `router.replace` keeps the history clean.
 *
 * Components that use this must sit under a <Suspense> boundary, because
 * useSearchParams opts the route out of static prerendering.
 */
export function useUrlParam(key: string, debounceMs = INPUT_DEBOUNCE_MS, resetKeys: readonly string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setLocalValue] = useState(() => searchParams.get(key) ?? "");

  const writeToUrl = useDebouncedCallback((next: string) => {
    const current = new URLSearchParams(window.location.search);
    if ((current.get(key) ?? "") === next) return;

    if (next) current.set(key, next);
    else current.delete(key);
    // Changing a filter should start the list again from page 1.
    for (const resetKey of resetKeys) current.delete(resetKey);

    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, debounceMs);

  const setValue = (next: string) => {
    setLocalValue(next);
    writeToUrl.run(next);
  };

  return [value, setValue] as const;
}
