"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {
  CreateWorkspaceInputSchema,
  WorkspaceCreatedSchema,
  slugify,
  type CreateWorkspaceInput,
} from "@userhq/types";
import { Field } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { SlugInput } from "../../../components/slug-input";
import { Button } from "../../../components/ui/button";
import { Alert } from "../../../components/ui/alert";
import { apiFetch, ApiClientError } from "../../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../../lib/api-errors";
import { flash } from "../../../components/ui/toaster";
import { QueryProvider } from "../../../lib/query-client";

export interface CreateWorkspaceFormProps {
  host: string;
}

function CreateWorkspaceFormInner({ host }: CreateWorkspaceFormProps): React.JSX.Element {
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(CreateWorkspaceInputSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const nameValue = watch("name");

  React.useEffect(() => {
    if (!slugTouched) {
      setValue("slug", slugify(nameValue || ""), {
        shouldValidate: slugTouched,
      });
    }
  }, [nameValue, slugTouched, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: CreateWorkspaceInput) => {
      return apiFetch("/api/v1/workspaces", {
        method: "POST",
        body: data,
        schema: WorkspaceCreatedSchema,
      });
    },
    onSuccess: (res) => {
      flash("Workspace created");
      window.location.assign(`/dashboard/${res.slug}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        const field = FIELD_FOR_CODE[err.code];
        if (field === "name" || field === "slug") {
          setError(field, { message: errorCopy(err) });
          return;
        }
      }
      const message =
        err instanceof ApiClientError ||
        (typeof err === "object" && err !== null && "status" in err)
          ? errorCopy(err as any)
          : errorCopy({ status: 500, code: "internal_error" });
      setAlertError(message);
    },
  });

  const onSubmit = (data: CreateWorkspaceInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  const nameError = errors.name?.message;
  const slugError = errors.slug?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={mutation.isPending} className="space-y-6">
        <Field
          id="workspace-name"
          label="Workspace name"
          error={nameError}
        >
          <Input
            placeholder="Acme Corp"
            {...register("name")}
          />
        </Field>

        <Field
          id="workspace-slug"
          label="URL"
          helper="Lowercase letters, numbers, and hyphens, 2–32 characters. You can't change this later."
          error={slugError}
        >
          <SlugInput
            prefix={`${host}/`}
            placeholder="acme"
            {...register("slug", {
              onChange: () => setSlugTouched(true),
            })}
          />
        </Field>

        {alertError && (
          <Alert variant="destructive">
            {alertError}
          </Alert>
        )}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                <span>Creating…</span>
              </>
            ) : (
              "Create workspace"
            )}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function CreateWorkspaceForm(props: CreateWorkspaceFormProps): React.JSX.Element {
  return (
    <QueryProvider>
      <CreateWorkspaceFormInner {...props} />
    </QueryProvider>
  );
}
