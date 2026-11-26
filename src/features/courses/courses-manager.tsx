"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormSkeleton } from "@/components/admin/form-skeleton";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDepartmentOptions } from "@/hooks/use-options";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Course } from "@/types/entities";

const FILTER_KEYS = ["departmentId"];

// Fetched when the dialog first opens; the skeleton has the form's 7 fields.
const CourseForm = dynamic(() => import("./course-form").then((m) => m.CourseForm), { loading: () => <FormSkeleton fields={7} /> });

export function CoursesManager() {
  const list = useListState(FILTER_KEYS);
  const departments = useDepartmentOptions();
  const [dialog, setDialog] = useState<{ item: Course | null } | null>(null);
  const [toDelete, setToDelete] = useState<Course | null>(null);

  const courses = useApiQuery({
    queryKey: queryKeys.courses.list(list.query),
    queryFn: () => apiListRequest<Course>("/courses", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/courses/${id}`, { method: "DELETE" }),
    successMessage: "Course deleted.",
    invalidate: [queryKeys.courses.all, queryKeys.courseOfferings.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Course>[] = [
    { id: "code", header: "Code", sortKey: "courseCode", cell: (c) => <Badge variant="outline" className="font-mono">{c.courseCode}</Badge> },
    { id: "title", header: "Title", sortKey: "title", cell: (c) => <span className="font-medium">{c.title}</span> },
    { id: "credits", header: "Credits", sortKey: "credits", className: "hidden sm:table-cell", cell: (c) => <span className="tabular-nums">{c.credits}</span> },
    {
      id: "type",
      header: "Type",
      className: "hidden md:table-cell",
      cell: (c) => <Badge variant="secondary" className="capitalize">{(c.courseType ?? "THEORY").toLowerCase()}</Badge>,
    },
    {
      id: "prerequisite",
      header: "Prerequisite",
      className: "hidden lg:table-cell",
      cell: (c) => (c.prerequisite ? <span className="font-mono text-xs">{c.prerequisite.courseCode}</span> : <span className="text-muted-foreground">—</span>),
    },
    { id: "department", header: "Department", className: "hidden md:table-cell", cell: (c) => <span className="text-muted-foreground">{c.department.name}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academic setup" title="Courses" description="The catalogue of courses, each owned by one department." />

      <ListToolbar
        searchLabel="Search courses"
        searchPlaceholder="Search by title or code"
        filters={
          <select
            aria-label="Filter by department"
            value={list.filters.departmentId ?? ""}
            onChange={(event) => list.update({ departmentId: event.target.value })}
            className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">All departments</option>
            {departments.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setDialog({ item: null })}>
            <Plus className="size-4" aria-hidden="true" />
            New course
          </Button>
        }
      />

      <DataTable
        caption="Courses"
        columns={columns}
        rows={courses.data?.data}
        isLoading={courses.isPending}
        isError={courses.isError}
        errorMessage={courses.error?.message}
        onRetry={() => void courses.refetch()}
        sortBy={list.sortBy ?? "courseCode"}
        sortOrder={list.sortOrder ?? "asc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={BookOpen}
        emptyTitle="No courses match"
        emptyDescription="Add a course, then schedule it as an offering for a semester."
        rowActions={(c) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.courseCode}`} onClick={() => setDialog({ item: c })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.courseCode}`} onClick={() => setToDelete(c)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={courses.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)} title={dialog?.item ? "Edit course" : "New course"}>
        {dialog ? <CourseForm item={dialog.item} departments={departments.options} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.courseCode ?? "course"}?`}
        description="The course is hidden from the catalogue. Offerings that use it are removed from the public list too."
        confirmLabel="Delete course"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
