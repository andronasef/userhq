"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  HEX_COLOR_RE,
  type ProductDetail,
  ProductDetailSchema,
} from "@userhq/types";
import { Button } from "../../../../../components/ui/button";
import { ColorField } from "../../../../../components/color-field";
import { Alert } from "../../../../../components/ui/alert";
import { accentTokens } from "../../../../../lib/accent";
import { apiFetch } from "../../../../../lib/api-client";
import { errorCopy } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";

export interface ProductBrandingFormProps {
  ws: string;
  product: ProductDetail;
}

function ProductBrandingFormInner({
  ws,
  product,
}: ProductBrandingFormProps): React.JSX.Element {
  const router = useRouter();
  const [accentColor, setAccentColor] = React.useState(product.accentColor);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const isValidHex = HEX_COLOR_RE.test(accentColor);
  const isDirty = accentColor.toUpperCase() !== product.accentColor.toUpperCase();
  const tokens = accentTokens(accentColor);

  const mutation = useMutation({
    mutationFn: async (hex: string) => {
      return apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
        method: "PATCH",
        body: { accentColor: hex },
        schema: ProductDetailSchema,
      });
    },
    onSuccess: (updated) => {
      setAccentColor(updated.accentColor);
      toast.success("Changes saved");
      router.refresh();
    },
    onError: (err: unknown) => {
      const message = errorCopy(err as any);
      setAlertError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidHex || !isDirty) return;
    setAlertError(null);
    mutation.mutate(accentColor.toUpperCase());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Branding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your accent color themes buttons, links, and highlights on the portal.
        </p>
      </div>

      <fieldset disabled={mutation.isPending} className="space-y-6">
        <ColorField
          label="Accent color"
          value={accentColor}
          onChange={(hex) => {
            setAccentColor(hex);
            setAlertError(null);
          }}
        />

        <div
          className="rounded-lg border border-border p-4 flex flex-col gap-3"
          style={
            {
              "--primary": tokens.primary,
              "--primary-foreground": tokens.primaryForeground,
              "--primary-text": tokens.primaryText,
            } as React.CSSProperties
          }
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Preview
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" size="sm">
              Sample button
            </Button>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-sm font-semibold underline text-[var(--primary-text)]"
            >
              Sample link
            </a>
          </div>
          {tokens.primaryText === "#171717" && (
            <p className="text-xs text-muted-foreground">
              This color is too light for text on white, so links will use dark
              text. Buttons still use your color.
            </p>
          )}
        </div>

        {alertError && (
          <Alert variant="destructive">
            {alertError}
          </Alert>
        )}

        <div>
          <Button
            type="submit"
            variant="outline"
            disabled={!isValidHex || !isDirty || mutation.isPending}
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

export function ProductBrandingForm(
  props: ProductBrandingFormProps
): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductBrandingFormInner {...props} />
    </QueryProvider>
  );
}
