"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextareaField, TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { useCourseOptions } from "@/hooks/use-options";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { COURSE_TYPE_OPTIONS, courseSchema, type CourseInput } from "@/lib/validations/admin";
import type { Course } from "@/types/entities";

/**
 * Create / edit course form. Loaded on demand (next/dynamic) when the dialog
 * opens, so the list page does not ship zod, TanStack Form and the field
 * components up front.
 */
export function CourseForm({ item, departments, onDone }: { item: Course | null; departments: { value: string; label: string }[]; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const courseOptions = useCourseOptions();
  // A course cannot be its own prerequisite.
  const prerequisites = courseOptions.options.filter((option) => option.value !== item?.id);

  const save = useApiMutation<Course, CourseInput>({
    mutationFn: (values) => {
      const body = {
        courseCode: values.courseCode,
        title: values.title,
        departmentId: values.departmentId,
        credits: Number(values.credits),
        courseType: values.courseType,
        // "" = no prerequisite. null clears an existing one on edit.
        prerequisiteId: values.prerequisiteId && values.prerequisiteId !== "none" ? values.prerequisiteId : item ? null : undefined,
        ...(values.description !== undefined ? { description: values.description } : {}),
      };
      return item
        ? apiRequest<Course>(`/courses/${item.id}`, { method: "PATCH", body })
        : apiRequest<Course>("/courses", { method: "POST", body });
    },
    notifyError: false,
    successMessage: item ? "Course updated." : "Course created.",
    invalidate: [queryKeys.courses.all, queryKeys.courseOfferings.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: {
      courseCode: item?.courseCode ?? "",
      title: item?.title ?? "",
      credits: item ? String(item.credits) : "3",
      departmentId: item?.departmentId ?? "",
      courseType: item?.courseType ?? ("THEORY" as const),
      prerequisiteId: item?.prerequisiteId ?? "",
      description: item?.description ?? "",
    },
    validators: { onSubmit: courseSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await save.mutateAsync(value);
        onDone();
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}

      <form.Field name="courseCode">{(field) => <TextInputField field={field} label="Course code" placeholder="CSE1010" />}</form.Field>
      <form.Field name="title">{(field) => <TextInputField field={field} label="Title" placeholder="Introduction to Programming" />}</form.Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <form.Field name="credits">{(field) => <TextInputField field={field} label="Credits" inputMode="decimal" hint="Whole or half credits, e.g. 3 or 1.5." />}</form.Field>
        <form.Field name="departmentId">
          {(field) => <SelectInputField field={field} label="Department" placeholder="Choose a department" options={departments} />}
        </form.Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <form.Field name="courseType">
          {(field) => <SelectInputField field={field} label="Course type" placeholder="Choose a type" options={COURSE_TYPE_OPTIONS} hint="Sets which credit-fee rate applies." />}
        </form.Field>
        <form.Field name="prerequisiteId">
          {(field) => <SelectInputField field={field} label="Prerequisite (optional)" placeholder="None" options={[{ value: "none", label: "None" }, ...prerequisites]} />}
        </form.Field>
      </div>
      <form.Field name="description">{(field) => <TextareaField field={field} label="Description (optional)" rows={3} />}</form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create course"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
