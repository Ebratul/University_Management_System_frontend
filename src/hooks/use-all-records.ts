"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useApiQuery } from "@/hooks/use-api-query";
import type { ListDataset } from "@/hooks/use-list-state";
import { apiListRequest } from "@/lib/api/client";
import type { ListQuery } from "@/types/api";

/** The API caps `limit` at 100; 50 pages bounds a "load all" at 5,000 records. */
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;
const CONCURRENCY = 5;

type Options<T> = {
  queryKey: QueryKey;
  path: string;
  dataset: ListDataset;
  /** Lazily imported generator for the sample dataset (its own JS chunk). */
  sample: () => Promise<T[]>;
  query?: ListQuery;
  enabled?: boolean;
};

/**
 * Every record of a list, for the virtualized "all" view.
 * Live: page 1 tells us how many pages exist, the rest are fetched 5 at a time.
 * Sample: the seeded generator, downloaded only when asked for.
 */
export function useAllRecords<T>({ queryKey, path, dataset, sample, query, enabled = true }: Options<T>) {
  return useApiQuery<{ rows: T[]; total: number; truncated: boolean }>({
    queryKey: [...queryKey, "all", dataset, query ?? {}],
    enabled,
    staleTime: dataset === "sample" ? Infinity : 30_000,
    queryFn: async () => {
      if (dataset === "sample") {
        const rows = await sample();
        return { rows, total: rows.length, truncated: false };
      }
      const first = await apiListRequest<T>(path, { ...query, page: 1, limit: PAGE_LIMIT });
      const pages = Math.min(first.meta.totalPages, MAX_PAGES);
      // A few requests at a time: parallel enough to be quick, gentle on the API rate limiter.
      const results = [first];
      for (let page = 2; page <= pages; page += CONCURRENCY) {
        const batch = Array.from({ length: Math.min(CONCURRENCY, pages - page + 1) }, (_, i) => apiListRequest<T>(path, { ...query, page: page + i, limit: PAGE_LIMIT }));
        results.push(...(await Promise.all(batch)));
      }
      const rows = results.flatMap((page) => page.data);
      return { rows, total: first.meta.total, truncated: first.meta.totalPages > MAX_PAGES };
    },
  });
}
