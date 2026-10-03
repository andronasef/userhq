"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {
  CreateProductInputSchema,
  ProductCreatedSchema,
  slugify,
  type CreateProductInput,
} from "@userhq/types";
import { Field } from "../../../../components/ui/field";
import { Input } from "../../../../components/ui/input";
import { SlugInput } from "../../../../components/slug-input";
import { LogoField, type LogoValue } from "../../../../components/logo-field";
import { Button } from "../../../../components/ui/button";
import { Alert } from "../../../../components/ui/alert";
import { apiFetch, ApiClientError } from "../../../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../../../lib/api-errors";
import { flash } from "../../../../components/ui/toaster";
import { QueryProvider } from "../../../../lib/query-client";

export interface CreateProductFormProps {
  ws: string;
  host: string;
}

function CreateProductFormInner({ ws, host }: CreateProductFormProps): React.JSX.Element {
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [logoValue, setLogoValue] = React.useState<LogoValue | null>(null);
  const [logoUploading, setLogoUploading] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductInputSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      slug: "",
      logoUploadId: null,
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
    mutationFn: async (data: CreateProductInput) => {
      return apiFetch(`/api/v1/workspaces/${ws}/products`, {
        method: "POST",
        body: data,
        schema: ProductCreatedSchema,
      });
    },
    onSuccess: (res) => {
      flash("Product created");
      window.location.assign(`/dashboard/${ws}/${res.slug}/settings`);
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

  const onSubmit = (data: CreateProductInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  const nameError = errors.name?.message;
  const slugError = errors.slug?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={mutation.isPending} className="space-y-6">
        <Field
          id="product-name"
          label="Product name"
          error={nameError}
        >
          <Input
            placeholder="e.g. Web App"
            {...register("name")}
          />
        </Field>

        <Field
          id="product-slug"
          label="URL"
          helper="Lowercase letters, numbers, and hyphens, 2–32 characters. You can't change this later."
          error={slugError}
        >
          <SlugInput
            prefix={`${host}/${ws}/`}
            placeholder="app"
            {...register("slug", {
              onChange: () => setSlugTouched(true),
            })}
          />
        </Field>

        <div className="space-y-2">
          <label className="text-sm font-semibold leading-none text-foreground">
            Logo
          </label>
          <LogoField
            value={logoValue}
            onChange={(v) => {
              setLogoValue(v);
              setValue("logoUploadId", v?.id ?? null, { shouldValidate: true });
            }}
            onPendingChange={setLogoUploading}
            name={nameValue || "Product"}
          />
        </div>

        {alertError && (
          <Alert variant="destructive">
            {alertError}
          </Alert>
        )}

        <div>
          <Button
            type="submit"
            disabled={mutation.isPending || logoUploading}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                <span>Creating…</span>
              </>
            ) : (
              "Create product"
            )}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function CreateProductForm(props: CreateProductFormProps): React.JSX.Element {
  return (
    <QueryProvider>
      <CreateProductFormInner {...props} />
    </QueryProvider>
  );
}
