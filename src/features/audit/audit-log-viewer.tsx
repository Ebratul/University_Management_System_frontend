"use client";

import { useMemo } from "react";

import { ScrollText } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { ListViewSwitch } from "@/components/admin/list-view-switch";
import { SampleDataNotice } from "@/components/admin/sample-data-notice";
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

  const active = isAll ? allLogs : logs;

  const columns: Column<AuditLog>[] = [
    { id: "when", header: "When", cell: (log) => <time dateTime={log.createdAt} className="text-muted-foreground text-xs whitespace-nowrap">{whenFormat.format(new Date(log.createdAt))}</time> },
    {
      id: "actor",
      header: "Actor",
      className: "hidden md:table-cell",
      cell: (log) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{log.performedByEmail ?? "System"}</p>
          {log.performedByRole ? <p className="text-muted-foreground text-xs">{log.performedByRole.toLowerCase()}</p> : null}
        </div>
      ),
    },
    { id: "action", header: "Action", cell: (log) => <Badge variant="outline" className="font-mono text-[11px]">{log.action}</Badge> },
    { id: "entity", header: "Entity", className: "hidden sm:table-cell", cell: (log) => <span className="text-sm">{log.entityType}</span> },
    { id: "description", header: "Details", className: "hidden lg:table-cell", cell: (log) => <span className="text-muted-foreground line-clamp-1 text-sm">{log.description ?? "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Oversight" title="Audit log" description="Who changed what, and when. Entries are written by the API and cannot be edited." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <DataTable
        caption="Audit log entries"
        columns={columns}
        rows={isAll ? visibleLogs : logs.data?.data}
        isLoading={active.isPending}
        isError={active.isError}
        errorMessage={active.error?.message}
        onRetry={() => void active.refetch()}
        emptyIcon={ScrollText}
        emptyTitle="No entries match"
        emptyDescription="Clear a filter to see more of the history."
      />

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
