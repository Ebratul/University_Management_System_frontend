"use client";

import type { ReactNode } from "react";

import { SearchField } from "@/components/catalog/search-field";
import { useUrlParam } from "@/hooks/use-url-param";

/** Shared top row for admin lists: search on the left, filters and the primary action on the right. */
const RESET_PAGE = ["page"];

export function useListSearch() {
  return useUrlParam("searchTerm", 300, RESET_PAGE);
}

export function ListToolbar({
  searchLabel,
  searchPlaceholder,
  filters,
  action,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  filters?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch label={searchLabel} placeholder={searchPlaceholder} />
        {filters}
      </div>
      {action ? <div className="flex justify-end">{action}</div> : null}
    </div>
  );
}

/**
 * The search box owns its own state (colocated). Typing re-renders this input
 * only; the list above it re-renders once, when the debounced value reaches the
 * URL. Before, the state lived in each manager, so every keystroke re-rendered
 * the whole manager: table, row menus and dialogs.
 */
function ListSearch({ label, placeholder }: { label: string; placeholder: string }) {
  const [search, setSearch] = useListSearch();
  return <SearchField label={label} placeholder={placeholder} value={search} onChange={setSearch} />;
}
