"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { EyeOff, Info, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  PRODUCT_FEATURE_KEYS,
  ProductFeaturesSchema,
  ProductDetailSchema,
  type ProductDetail,
  type ProductFeatures,
} from "@userhq/types";
import { Alert } from "../../../../../components/ui/alert";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { apiFetch } from "../../../../../lib/api-client";
import { errorCopy } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";

type FeatureKey = (typeof PRODUCT_FEATURE_KEYS)[number];
const FEATURE_COPY: Record<FeatureKey, { name: string; description: string }> =
  {
    board: {
      name: "Feedback board",
      description:
        "Customers submit ideas, vote, and comment. Turning it off also stops customer notifications about feedback.",
    },
    roadmap: {
      name: "Roadmap",
      description: "Customers see what is planned and in progress.",
    },
    changelog: {
      name: "Changelog",
      description: "Customers read your release notes.",
    },
    faq: {
      name: "FAQ",
      description: "Customers search answers to common questions.",
    },
  };
interface ProductFeaturesFormProps {
  ws: string;
  product: ProductDetail;
  host: string;
}
type PendingSave = {
  features: Partial<ProductFeatures>;
  turningOff: FeatureKey[];
  allOff: boolean;
};

function ProductFeaturesFormInner({
  ws,
  product,
  host,
}: ProductFeaturesFormProps) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const [savedFeatures, setSavedFeatures] = React.useState(product.features);
  const [pendingSave, setPendingSave] = React.useState<PendingSave | null>(
    null,
  );
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty, dirtyFields },
  } = useForm<ProductFeatures>({
    resolver: zodResolver(ProductFeaturesSchema),
    defaultValues: product.features,
  });
  const values = watch();
  const allOff = PRODUCT_FEATURE_KEYS.every((key) => !values[key]);
  const mutation = useMutation({
    mutationFn: (features: Partial<ProductFeatures>) =>
      apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
        method: "PATCH",
        body: { features },
        schema: ProductDetailSchema,
      }),
    onSuccess: (updated) => {
      setAlertError(null);
      setSavedFeatures(updated.features);
      reset(updated.features);
      toast.success("Features updated");
      router.refresh();
    },
    onError: (error) => setAlertError(errorCopy(error)),
  });
  const submit = (data: ProductFeatures) => {
    setAlertError(null);
    const features: Partial<ProductFeatures> = {};
    for (const key of PRODUCT_FEATURE_KEYS) {
      if (dirtyFields[key]) features[key] = data[key];
    }
    const turningOff = PRODUCT_FEATURE_KEYS.filter(
      (key) => savedFeatures[key] && features[key] === false,
    );
    if (turningOff.length) setPendingSave({ features, turningOff, allOff });
    else mutation.mutate(features);
  };
  const names =
    pendingSave?.turningOff.map((key) => FEATURE_COPY[key].name) ?? [];
  const nameList = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(names);
  const confirmTitle = pendingSave?.allOff
    ? "Hide everything from customers?"
    : names.length === 1
      ? `Hide ${names[0]} from customers?`
      : `Hide ${names.length} features from customers?`;
  const confirmDescription =
    (pendingSave?.allOff
      ? "Customers will see an unavailable page instead of your portal. Your content is kept, and you can turn features back on at any time."
      : names.length === 1
        ? `Customers will no longer see ${names[0]} or open links to it. Your content is kept, and you can turn ${names[0]} back on at any time.`
        : `Customers will no longer see ${nameList}. Your content is kept, and you can turn them back on at any time.`) +
    (pendingSave?.turningOff.includes("board")
      ? " Customers also stop getting notifications about feedback. Notifications for activity while it is off are not sent later."
      : "");

  return (
    <section
      id="portal-features"
      className="border-t border-border pt-8 mt-8 scroll-mt-24 space-y-4"
    >
      <h2 className="text-base font-semibold leading-tight">Portal features</h2>
      <p id="portal-features-help" className="text-sm text-muted-foreground">
        Choose what customers can see for this product. Turning a feature off
        hides it from your portal and keeps all of its content. You can still
        manage it here and turn it back on at any time.
      </p>
      <form onSubmit={handleSubmit(submit)}>
        <fieldset
          aria-describedby="portal-features-help"
          disabled={!ready || mutation.isPending}
          className="space-y-4"
        >
          <legend className="sr-only">Features visible to customers</legend>
          <div className="flex flex-col gap-2">
            {PRODUCT_FEATURE_KEYS.map((key) => (
              <label
                key={key}
                className="flex min-h-11 items-start gap-4 rounded-lg border border-border bg-card p-4 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="checkbox"
                  defaultChecked={product.features[key]}
                  id={`feature-${key}`}
                  aria-labelledby={`feature-${key}-name`}
                  aria-describedby={`feature-${key}-desc`}
                  className="mt-1 size-4 rounded border-border accent-foreground cursor-pointer"
                  {...register(key)}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      id={`feature-${key}-name`}
                      className="text-sm font-semibold text-foreground"
                    >
                      {FEATURE_COPY[key].name}
                    </span>
                    {!savedFeatures[key] && (
                      <Badge variant="outline">
                        <EyeOff className="size-3 mr-1" aria-hidden />
                        Hidden from customers
                      </Badge>
                    )}
                  </span>
                  <span
                    id={`feature-${key}-desc`}
                    className="text-sm text-muted-foreground"
                  >
                    {FEATURE_COPY[key].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {allOff && (
            <p
              role="status"
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Info className="size-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                With every feature off, customers see an unavailable page at{" "}
                {host}/{ws}/{product.slug}.
              </span>
            </p>
          )}
          {alertError && <Alert variant="destructive">{alertError}</Alert>}
          <Button
            type="submit"
            disabled={!isDirty || mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              "Save features"
            )}
          </Button>
        </fieldset>
      </form>
      <ConfirmDialog
        open={pendingSave !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSave(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        dismissLabel="Keep visible"
        confirmVariant="default"
        confirmLabel={
          pendingSave?.allOff
            ? "Hide everything"
            : names.length === 1
              ? `Hide ${names[0]}`
              : `Hide ${names.length} features`
        }
        pendingLabel="Saving…"
        onConfirm={async () => {
          if (pendingSave) await mutation.mutateAsync(pendingSave.features);
        }}
      />
    </section>
  );
}

export function ProductFeaturesForm(props: ProductFeaturesFormProps) {
  return (
    <QueryProvider>
      <ProductFeaturesFormInner {...props} />
    </QueryProvider>
  );
}
