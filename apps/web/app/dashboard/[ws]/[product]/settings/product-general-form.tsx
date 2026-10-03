"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  UpdateProductInputSchema,
  ProductDetailSchema,
  type ProductDetail,
  type UpdateProductInput,
} from "@userhq/types";
import { Field } from "../../../../../components/ui/field";
import { Input } from "../../../../../components/ui/input";
import { SlugInput } from "../../../../../components/slug-input";
import { LogoField, type LogoValue } from "../../../../../components/logo-field";
import { Button } from "../../../../../components/ui/button";
import { Alert } from "../../../../../components/ui/alert";
import { apiFetch, ApiClientError } from "../../../../../lib/api-client";
import { errorCopy, FIELD_FOR_CODE } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";

export interface ProductGeneralFormProps {
  ws: string;
  product: ProductDetail;
  host: string;
  workspaceName: string;
}

function ProductGeneralFormInner({
  ws,
  product,
  host,
  workspaceName,
}: ProductGeneralFormProps): React.JSX.Element {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [logoValue, setLogoValue] = React.useState<LogoValue | null>(
    product.logoUploadId && product.logoUrl
      ? { id: product.logoUploadId, url: product.logoUrl }
      : null
  );
  const [logoUploading, setLogoUploading] = React.useState(false);

  const defaultValues: UpdateProductInput = {
    name: product.name,
    logoUploadId: product.logoUploadId ?? null,
    tagline: product.tagline ?? "",
    websiteUrl: product.websiteUrl ?? "",
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProductInput>({
    resolver: zodResolver(UpdateProductInputSchema),
    mode: "onTouched",
    defaultValues,
  });

  const nameValue = watch("name");
  const taglineValue = watch("tagline") ?? "";
  const taglineLength = (typeof taglineValue === "string" ? taglineValue : "").length;

  const mutation = useMutation({
    mutationFn: async (data: UpdateProductInput) => {
      return apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
        method: "PATCH",
        body: data,
        schema: ProductDetailSchema,
      });
    },
    onSuccess: (updated) => {
      toast.success("Changes saved");
      reset({
        name: updated.name,
        logoUploadId: updated.logoUploadId ?? null,
        tagline: updated.tagline ?? "",
        websiteUrl: updated.websiteUrl ?? "",
      });
      router.refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code) {
        const field = FIELD_FOR_CODE[err.code];
        if (field && ["name", "tagline", "websiteUrl"].includes(field)) {
          setError(field as any, { message: errorCopy(err) });
          return;
        }
      }
      const message = errorCopy(err as any);
      setAlertError(message);
    },
  });

  const onSubmit = (data: UpdateProductInput) => {
    setAlertError(null);
    mutation.mutate(data);
  };

  const handleCopyUrl = async () => {
    const origin = typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : `https://${host}`;
    const portalUrl = `${origin}/${ws}/${product.slug}`;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const nameError = errors.name?.message;
  const taglineError = errors.tagline?.message;
  const websiteError = errors.websiteUrl?.message;

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
          id="product-url"
          label="URL"
          helper="The URL can't be changed, so links to your portal never break."
        >
          <div className="flex gap-2 items-center">
            <SlugInput
              prefix={`${host}/${ws}/`}
              value={product.slug}
              readOnly
              disabled
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyUrl}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span>Copy URL</span>
                </>
              )}
            </Button>
          </div>
        </Field>

        <div className="space-y-2">
          <label className="text-sm font-semibold leading-none text-foreground">
            Logo
          </label>
          <LogoField
            value={logoValue}
            onChange={(v) => {
              setLogoValue(v);
              setValue("logoUploadId", v?.id ?? null, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
            onPendingChange={setLogoUploading}
            name={nameValue || product.name}
            accent={product.accentColor}
          />
        </div>

        <Field
          id="product-tagline"
          label="Tagline"
          helper={`One line shown on your portal and in link previews. ${taglineLength}/80`}
          error={taglineError}
        >
          <Input
            placeholder="e.g. The fastest way to gather customer feedback"
            {...register("tagline")}
          />
        </Field>

        <Field
          id="product-website"
          label="Website"
          helper={`Shown as "Back to ${workspaceName}" on your portal. Leave empty to use the workspace website.`}
          error={websiteError}
        >
          <Input
            type="url"
            placeholder="https://example.com"
            {...register("websiteUrl")}
          />
        </Field>

        {alertError && (
          <Alert variant="destructive">
            {alertError}
          </Alert>
        )}

        <div>
          <Button
            type="submit"
            disabled={!isDirty || mutation.isPending || logoUploading}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ProductGeneralForm(
  props: ProductGeneralFormProps
): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductGeneralFormInner {...props} />
    </QueryProvider>
  );
}
