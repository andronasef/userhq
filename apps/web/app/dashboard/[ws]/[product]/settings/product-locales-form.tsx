"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Globe, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  type ProductDetail,
  ProductDetailSchema,
  type SupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_CATALOG,
  DEFAULT_LOCALE,
  isRtl,
} from "@userhq/types";
import { Button } from "../../../../../components/ui/button";
import { apiFetch } from "../../../../../lib/api-client";
import { errorCopy } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";
import { useI18n } from "../../../../../lib/i18n/context";
import { cn } from "../../../../../lib/utils";

export interface ProductLocalesFormProps {
  ws: string;
  product: ProductDetail;
}

function ProductLocalesFormInner({
  ws,
  product,
}: ProductLocalesFormProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useI18n();

  const initialDefault = product.locales?.defaultLocale ?? DEFAULT_LOCALE;
  const initialEnabled = (product.locales?.enabledLocales && product.locales.enabledLocales.length > 0)
    ? product.locales.enabledLocales
    : [DEFAULT_LOCALE];

  const [defaultLocale, setDefaultLocale] = React.useState<SupportedLocale>(initialDefault);
  const [enabledLocales, setEnabledLocales] = React.useState<SupportedLocale[]>(initialEnabled);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const isDirty =
    defaultLocale !== initialDefault ||
    enabledLocales.length !== initialEnabled.length ||
    enabledLocales.some((l) => !initialEnabled.includes(l));

  const toggleLocale = (code: SupportedLocale) => {
    setErrorMsg(null);
    if (enabledLocales.includes(code)) {
      if (enabledLocales.length <= 1) {
        setErrorMsg("At least one language must remain enabled.");
        return;
      }
      const next = enabledLocales.filter((l) => l !== code);
      setEnabledLocales(next);
      if (defaultLocale === code) {
        setDefaultLocale(next[0] || DEFAULT_LOCALE);
      }
    } else {
      setEnabledLocales([...enabledLocales, code]);
    }
  };

  const mutation = useMutation({
    mutationFn: async (payload: {
      locales: { defaultLocale: SupportedLocale; enabledLocales: SupportedLocale[] };
    }) => {
      return apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
        method: "PATCH",
        body: payload,
        schema: ProductDetailSchema,
      });
    },
    onSuccess: (updated) => {
      toast.success(t("dashboard.languagesSaved"));
      if (updated.locales?.defaultLocale) setDefaultLocale(updated.locales.defaultLocale);
      if (updated.locales?.enabledLocales) setEnabledLocales(updated.locales.enabledLocales);
      router.refresh();
    },
    onError: (err) => {
      const msg = errorCopy(err);
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enabledLocales.includes(defaultLocale)) {
      setErrorMsg(t("ui.defaultMustBeEnabled"));
      return;
    }
    setErrorMsg(null);
    mutation.mutate({
      locales: {
        defaultLocale,
        enabledLocales,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Globe className="size-4 text-foreground/70" aria-hidden="true" />
            {t("dashboard.languagesAndLocales")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("ui.languagesDescription")}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Default Locale Selector */}
      <div className="space-y-2">
        <label
          htmlFor="defaultLocaleSelect"
          className="text-xs font-semibold text-foreground uppercase tracking-wider block"
        >
          {t("dashboard.defaultLanguage")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("ui.defaultLanguageHint")}
        </p>
        <select
          id="defaultLocaleSelect"
          value={defaultLocale}
          onChange={(e) => {
            const val = e.target.value as SupportedLocale;
            setDefaultLocale(val);
            if (!enabledLocales.includes(val)) {
              setEnabledLocales((prev) => [...prev, val]);
            }
          }}
          className="h-9 px-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs"
        >
          {SUPPORTED_LOCALES.map((code) => {
            const meta = LOCALE_CATALOG[code];
            return (
              <option key={code} value={code}>
                {meta.nativeName} ({meta.name}) {isRtl(code) ? "— RTL" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Enabled Locales Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
          {t("dashboard.enabledLanguages")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("ui.enabledLanguagesHint")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {SUPPORTED_LOCALES.map((code) => {
            const meta = LOCALE_CATALOG[code];
            const isEnabled = enabledLocales.includes(code);
            const isDefault = defaultLocale === code;
            const rtl = isRtl(code);

            return (
              <button
                type="button"
                key={code}
                onClick={() => toggleLocale(code)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all cursor-pointer",
                  isEnabled
                    ? "border-primary/50 bg-primary/5 text-foreground hover:bg-primary/10 shadow-xs"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground opacity-60",
                )}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-medium flex items-center gap-1.5">
                    <span className="truncate">{meta.nativeName}</span>
                    {rtl && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-muted text-muted-foreground">
                        RTL
                      </span>
                    )}
                    {isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{meta.name}</div>
                </div>

                <div
                  className={cn(
                    "size-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isEnabled
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 bg-background",
                  )}
                >
                  {isEnabled && <Check className="size-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button
          type="submit"
          disabled={!isDirty || mutation.isPending}
          className="min-w-24"
        >
          {mutation.isPending ? (
            <>
              <LoaderCircle className="size-4 animate-spin mr-2" />
              {t("common.saving")}
            </>
          ) : (
            t("ui.saveChanges")
          )}
        </Button>
      </div>
    </form>
  );
}

export function ProductLocalesForm(props: ProductLocalesFormProps): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductLocalesFormInner {...props} />
    </QueryProvider>
  );
}
