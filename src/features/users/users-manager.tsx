"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, UserRound } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormSkeleton } from "@/components/admin/form-skeleton";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { ListViewSwitch } from "@/components/admin/list-view-switch";
import { SampleDataNotice } from "@/components/admin/sample-data-notice";
import { VirtualTable } from "@/components/admin/virtual-table";
import { Pagination } from "@/components/admin/pagination";
import { RowMenu, type RowMenuItem } from "@/components/admin/row-menu";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAllRecords } from "@/hooks/use-all-records";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ROLE_META } from "@/lib/auth/roles";
import type { AdminUser, Role } from "@/types/entities";

const FILTER_KEYS = ["role"];

// Fetched when the dialog first opens; the skeleton has the form's 4 fields.
const AdminCreateForm = dynamic(() => import("./admin-create-form").then((m) => m.AdminCreateForm), { loading: () => <FormSkeleton fields={4} /> });
const ROLES: Role[] = ["ADMIN", "FACULTY", "STUDENT"];
/** Hoisted: one formatter for every row instead of a new one per cell (same output as toLocaleDateString("en-GB")). */
const createdFormat = new Intl.DateTimeFormat("en-GB");

const displayName = (user: AdminUser) => user.admin?.name ?? user.faculty?.name ?? user.student?.name ?? user.email;

export function UsersManager() {
  const list = useListState(FILTER_KEYS);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const isAll = list.view === "all";
  const isSample = isAll && list.dataset === "sample";

  const users = useApiQuery({
    queryKey: queryKeys.users.list(list.query),
    queryFn: () => apiListRequest<AdminUser>("/users", list.query),
    keepPreviousData: true,
    enabled: !isAll,
  });

  // "All records" view: every account (or the generated sample), filtered here.
  const allUsers = useAllRecords<AdminUser>({
    queryKey: queryKeys.users.all,
    path: "/users",
    dataset: list.dataset,
    sample: () => import("@/lib/sample-data").then((m) => m.sampleUsers()),
    enabled: isAll,
  });
  const roleFilter = list.filters.role;
  const term = list.searchTerm?.toLowerCase();
  // Filtering thousands of rows is the expensive step: memoised on its real inputs only.
  const visibleUsers = useMemo(() => {
    const rows = allUsers.data?.rows;
    if (!rows) return undefined;
    return rows.filter((user) => (!roleFilter || user.role === roleFilter) && (!term || user.email.toLowerCase().includes(term) || displayName(user).toLowerCase().includes(term)));
  }, [allUsers.data, roleFilter, term]);


  const invalidateUsers = [queryKeys.users.all, queryKeys.adminStats];

  const changeRole = useApiMutation<AdminUser, { user: AdminUser; role: Role }>({
    mutationFn: ({ user, role }) => apiRequest<AdminUser>(`/users/${user.id}/role`, { method: "PATCH", body: { role } }),
    successMessage: ({ role }) => `Role changed to ${ROLE_META[role].label}.`,
    invalidate: invalidateUsers,
  });

  const changeStatus = useApiMutation<AdminUser, { user: AdminUser; isActive: boolean }>({
    mutationFn: ({ user, isActive }) => apiRequest<AdminUser>(`/users/${user.id}/status`, { method: "PATCH", body: { isActive } }),
    successMessage: ({ isActive }) => (isActive ? "Account activated." : "Account deactivated."),
    invalidate: invalidateUsers,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/users/${id}`, { method: "DELETE" }),
    successMessage: "Account deleted.",
    invalidate: invalidateUsers,
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<AdminUser>[] = [
    {
      id: "email",
      header: "Account",
      width: "minmax(0,2fr)",
      cell: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName(user)}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
      ),
    },
    { id: "role", header: "Role", width: "150px", cell: (user) => <Badge variant="secondary">{ROLE_META[user.role].label}</Badge> },
    {
      id: "status",
      header: "Status",
      width: "120px",
      className: "hidden sm:table-cell",
      cell: (user) => (user.isActive ? <Badge>Active</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>),
    },
    {
      id: "createdAt",
      header: "Created",
      width: "130px",
      className: "hidden lg:table-cell",
      cell: (user) => <span className="text-muted-foreground text-sm">{createdFormat.format(new Date(user.createdAt))}</span>,
    },
  ];

  const renderActions = (user: AdminUser) => {
    const items: RowMenuItem[] = [
      ...ROLES.filter((role) => role !== user.role).map((role) => ({
        label: `Make ${ROLE_META[role].label.toLowerCase()}`,
        onSelect: () => changeRole.mutate({ user, role }),
      })),
      {
        label: user.isActive ? "Deactivate account" : "Activate account",
        onSelect: () => changeStatus.mutate({ user, isActive: !user.isActive }),
      },
      { label: "Delete account", destructive: true, onSelect: () => setToDelete(user) },
    ];
    return <RowMenu label={user.email} groupLabel="Account" items={items} />;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Users" description="Every login in the system. Changing a role only works if the account already has a profile for that role." />

      <ListToolbar
        searchLabel="Search users"
        searchPlaceholder="Search by email"
        filters={
          <select
            aria-label="Filter by role"
            value={list.filters.role ?? ""}
            onChange={(event) => list.update({ role: event.target.value })}
            className="border-input bg-card h-10 rounded-lg border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_META[role].label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New administrator
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListViewSwitch view={list.view} dataset={list.dataset} onChange={list.update} />
        {isAll && visibleUsers ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visibleUsers.length.toLocaleString()} of {(allUsers.data?.total ?? 0).toLocaleString()} accounts
          </p>
        ) : null}
      </div>
      {isSample ? <SampleDataNotice onExit={() => list.update({ dataset: undefined })} /> : null}

      {isAll ? (
        <VirtualTable
          caption="User accounts (all records)"
          columns={columns}
          rows={visibleUsers}
          isLoading={allUsers.isPending}
          isError={allUsers.isError}
          errorMessage={allUsers.error?.message}
          onRetry={() => void allUsers.refetch()}
          emptyIcon={UserRound}
          emptyTitle="No accounts match"
          emptyDescription="Try another search or role filter."
          rowActions={isSample ? undefined : renderActions}
        />
      ) : (
        <DataTable
          caption="User accounts"
          columns={columns}
          rows={users.data?.data}
          isLoading={users.isPending}
          isError={users.isError}
          errorMessage={users.error?.message}
          onRetry={() => void users.refetch()}
          emptyIcon={UserRound}
          emptyTitle="No accounts match"
          emptyDescription="Try another search or role filter."
          rowActions={renderActions}
        />
      )}


      {isAll ? null : <Pagination meta={users.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />}

      <FormDialog open={creating} onOpenChange={setCreating} title="New administrator" description="Creates an admin login. Share the temporary password through a secure channel.">
        {creating ? <AdminCreateForm onDone={() => setCreating(false)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.email ?? "account"}?`}
        description="The login is removed and cannot sign in. Records the account created (enrolments, notices, results) stay in place."
        confirmLabel="Delete account"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
