"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  HEX_COLOR_RE,
  type ProductDetail,
  ProductDetailSchema,
} from "@userhq/types";
import { Button } from "../../../../../components/ui/button";
import {
  ColorField,
  type ColorPreset,
} from "../../../../../components/color-field";
import { Alert } from "../../../../../components/ui/alert";
import { accentTokens, contrastRatio } from "../../../../../lib/accent";
import { apiFetch } from "../../../../../lib/api-client";
import { errorCopy } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";

const BUTTON_TEXT_PRESETS: readonly ColorPreset[] = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Slate 900", hex: "#0F172A" },
  { name: "Slate 100", hex: "#F1F5F9" },
  { name: "Zinc 800", hex: "#27272A" },
  { name: "Cream", hex: "#FFFBEB" },
] as const;

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
  const [accentTextColor, setAccentTextColor] = React.useState<string>(
    product.accentTextColor ?? ""
  );
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const isValidAccent = HEX_COLOR_RE.test(accentColor);
  const isValidAccentText =
    !accentTextColor || HEX_COLOR_RE.test(accentTextColor);

  const origAccent = product.accentColor.toUpperCase();
  const origText = (product.accentTextColor ?? "").toUpperCase();
  const currentAccent = accentColor.toUpperCase();
  const currentText = accentTextColor.toUpperCase();

  const isDirty =
    currentAccent !== origAccent || currentText !== origText;

  const autoTokens = accentTokens(accentColor);
  const autoFg = autoTokens.primaryForeground;

  const tokens = accentTokens(accentColor, accentTextColor || null);
  const fgRatio = contrastRatio(tokens.primaryForeground, tokens.primary);
  const isLowContrast = fgRatio < 3.0;

  const mutation = useMutation({
    mutationFn: async (payload: {
      accentColor: string;
      accentTextColor: string | null;
    }) => {
      return apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
        method: "PATCH",
        body: payload,
        schema: ProductDetailSchema,
      });
    },
    onSuccess: (updated) => {
      setAccentColor(updated.accentColor);
      setAccentTextColor(updated.accentTextColor ?? "");
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
    if (!isValidAccent || !isValidAccentText || !isDirty) return;
    setAlertError(null);
    mutation.mutate({
      accentColor: currentAccent,
      accentTextColor: currentText ? currentText : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Branding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your product's accent color and button text styling on the public portal.
        </p>
      </div>

      <fieldset disabled={mutation.isPending} className="space-y-6">
        <ColorField
          label="Accent color"
          description="Themes buttons, highlights, badges, and focus rings."
          value={accentColor}
          onChange={(hex) => {
            setAccentColor(hex);
            setAlertError(null);
          }}
        />

        <ColorField
          label="Button text color"
          description="Color of text and icons appearing on buttons and accent-filled surfaces."
          value={accentTextColor}
          onChange={(hex) => {
            setAccentTextColor(hex);
            setAlertError(null);
          }}
          presets={BUTTON_TEXT_PRESETS}
          allowAuto={true}
          autoLabel="Auto"
          autoValue={autoFg}
          placeholder={`Auto (${autoFg})`}
        />

        <div
          className="rounded-lg border border-border p-4 flex flex-col gap-3 transition-colors"
          style={
            {
              "--primary": tokens.primary,
              "--primary-foreground": tokens.primaryForeground,
              "--primary-text": tokens.primaryText,
              "--ring": tokens.primary,
            } as React.CSSProperties
          }
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live Preview
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" size="sm">
              Primary Button
            </Button>
            <Button type="button" size="sm" variant="outline">
              Outline Button
            </Button>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-sm font-semibold underline text-[var(--primary-text)]"
            >
              Sample link
            </a>
          </div>

          {isLowContrast && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mt-1">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                Low contrast ({fgRatio.toFixed(1)}:1). Visitors may have difficulty reading button text. Consider choosing Auto or a higher contrast color.
              </span>
            </div>
          )}

          {tokens.primaryText === "#171717" && (
            <p className="text-xs text-muted-foreground">
              This accent color is light on white surfaces, so standalone links will use dark text while buttons use your primary background.
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
            disabled={
              !isValidAccent || !isValidAccentText || !isDirty || mutation.isPending
            }
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
