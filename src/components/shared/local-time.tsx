"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * A time in the viewer's own time zone. The server does not know that zone, so
 * the text appears after hydration; the box keeps its width meanwhile.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {mounted ? new Date(iso).toLocaleTimeString() : " "}
    </time>
  );
}
