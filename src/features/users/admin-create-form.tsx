"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";

import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { adminUserSchema, type AdminUserInput } from "@/lib/validations/admin";
import type { AdminUser } from "@/types/entities";

/**
 * New administrator form. Loaded on demand (next/dynamic) when the dialog
 * opens, so the users list does not ship zod, TanStack Form and the field
 * components up front.
 */
export function AdminCreateForm({ onDone }: { onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const create = useApiMutation<AdminUser, AdminUserInput>({
    mutationFn: (values) =>
      apiRequest<AdminUser>("/users", {
        method: "POST",
        body: { name: values.name, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) },
      }),
    notifyError: false,
    successMessage: "Administrator created.",
    invalidate: [queryKeys.users.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", phone: "" },
    validators: { onSubmit: adminUserSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await create.mutateAsync(value);
        onDone();
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}
      <form.Field name="name">{(field) => <TextInputField field={field} label="Full name" />}</form.Field>
      <form.Field name="email">{(field) => <TextInputField field={field} label="Email" type="email" autoComplete="off" />}</form.Field>
      <form.Field name="password">{(field) => <TextInputField field={field} label="Temporary password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower, number and symbol." />}</form.Field>
      <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone (optional)" type="tel" />}</form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Creating…" : "Create administrator"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

