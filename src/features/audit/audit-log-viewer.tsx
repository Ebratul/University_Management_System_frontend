"use client";

import { useMemo } from "react";

import { ScrollText } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { ListViewSwitch } from "@/components/admin/list-view-switch";
import { SampleDataNotice } from "@/components/admin/sample-data-notice";
import { VirtualTable } from "@/components/admin/virtual-table-lazy";
import { Pagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAllRecords } from "@/hooks/use-all-records";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { useUrlParam } from "@/hooks/use-url-param";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AuditLog } from "@/types/entities";

const FILTER_KEYS = ["action", "entityType", "from", "to"];
const RESET_PAGE = ["page"];
/** Hoisted: one formatter for all rows (same output as toLocaleString("en-GB")). */
const whenFormat = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Module scope: the columns depend on no state, so the table always gets the
 * same array. Built inside the component, a new array on every render made
 * every visible row re-render while a filter was typed.
 */
const COLUMNS: Column<AuditLog>[] = [
  { id: "when", header: "When", width: "180px", cell: (log) => <time dateTime={log.createdAt} className="text-muted-foreground text-xs whitespace-nowrap">{whenFormat.format(new Date(log.createdAt))}</time> },
  {
    id: "actor",
    header: "Actor",
    width: "minmax(0,1.4fr)",
    className: "hidden md:table-cell",
    cell: (log) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{log.performedByEmail ?? "System"}</p>
        {log.performedByRole ? <p className="text-muted-foreground text-xs">{log.performedByRole.toLowerCase()}</p> : null}
      </div>
    ),
  },
  { id: "action", header: "Action", width: "minmax(0,1.3fr)", cell: (log) => <Badge variant="outline" className="font-mono text-[11px]">{log.action}</Badge> },
  { id: "entity", header: "Entity", className: "hidden sm:table-cell", width: "140px", cell: (log) => <span className="text-sm">{log.entityType}</span> },
  { id: "description", header: "Details", className: "hidden lg:table-cell", width: "minmax(0,2fr)", cell: (log) => <span className="text-muted-foreground line-clamp-1 text-sm">{log.description ?? "—"}</span> },
];

/** Read-only history of every mutating action. Filters are kept in the URL. */
export function AuditLogViewer() {
  const list = useListState(FILTER_KEYS);

  const isAll = list.view === "all";

  const logs = useApiQuery({
    queryKey: queryKeys.auditLogs.list(list.query),
    queryFn: () => apiListRequest<AuditLog>("/admin/audit-logs", list.query),
    keepPreviousData: true,
    enabled: !isAll,
  });

  // "All records" view: the whole history (or the generated sample), filtered here.
  const allLogs = useAllRecords<AuditLog>({
    queryKey: queryKeys.auditLogs.all,
    path: "/admin/audit-logs",
    dataset: list.dataset,
    sample: () => import("@/lib/sample-data").then((m) => m.sampleAuditLogs()),
    enabled: isAll,
  });
  const { action, entityType, from, to } = list.filters;
  // Memoised: re-filters thousands of rows only when the rows or a filter value change.
  const visibleLogs = useMemo(() => {
    const rows = allLogs.data?.rows;
    if (!rows) return undefined;
    const actionTerm = action?.toLowerCase();
    const entityTerm = entityType?.toLowerCase();
    const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
    const toIso = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined;
    return rows.filter(
      (log) =>
        (!actionTerm || log.action.toLowerCase().includes(actionTerm)) &&
        (!entityTerm || log.entityType.toLowerCase().includes(entityTerm)) &&
        (!fromIso || log.createdAt >= fromIso) &&
        (!toIso || log.createdAt <= toIso),
    );
  }, [allLogs.data, action, entityType, from, to]);



  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Oversight" title="Audit log" description="Who changed what, and when. Entries are written by the API and cannot be edited." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField paramKey="action" label="Action" placeholder="e.g. PAYMENT_COMPLETED" />
        <FilterField paramKey="entityType" label="Entity type" placeholder="e.g. Payment" />
        <FilterField paramKey="from" label="From" type="date" />
        <FilterField paramKey="to" label="To" type="date" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListViewSwitch view={list.view} dataset={list.dataset} onChange={list.update} />
        {isAll && visibleLogs ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visibleLogs.length.toLocaleString()} of {(allLogs.data?.total ?? 0).toLocaleString()} entries
          </p>
        ) : null}
      </div>
      {isAll && list.dataset === "sample" ? <SampleDataNotice onExit={() => list.update({ dataset: undefined })} /> : null}

      {isAll ? (
        <VirtualTable
          caption="Audit log entries (all records)"
          columns={COLUMNS}
          rows={visibleLogs}
          isLoading={allLogs.isPending}
          isError={allLogs.isError}
          errorMessage={allLogs.error?.message}
          onRetry={() => void allLogs.refetch()}
          emptyIcon={ScrollText}
          emptyTitle="No entries match"
          emptyDescription="Clear a filter to see more of the history."
        />
      ) : (
        <DataTable
          caption="Audit log entries"
          columns={COLUMNS}
          rows={logs.data?.data}
          isLoading={logs.isPending}
          isError={logs.isError}
          errorMessage={logs.error?.message}
          onRetry={() => void logs.refetch()}
          emptyIcon={ScrollText}
          emptyTitle="No entries match"
          emptyDescription="Clear a filter to see more of the history."
        />
      )}

      {isAll ? null : <Pagination meta={logs.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />}
    </div>
  );
}

/** A filter input bound to one URL parameter. Typing is debounced, so the URL updates once the user pauses. */
function FilterField({ paramKey, label, placeholder, type = "text" }: { paramKey: string; label: string; placeholder?: string; type?: string }) {
  const [value, setValue] = useUrlParam(paramKey, 300, RESET_PAGE);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`audit-${paramKey}`} className="text-xs">{label}</Label>
      <Input id={`audit-${paramKey}`} type={type} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} className="h-10" />
    </div>
  );
}
