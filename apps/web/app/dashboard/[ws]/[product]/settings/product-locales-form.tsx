"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Globe, Check, AlertCircle, ArrowRightLeft, Sparkles } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../../../components/ui/dialog";
import { apiFetch } from "../../../../../lib/api-client";
import { errorCopy } from "../../../../../lib/api-errors";
import { QueryProvider } from "../../../../../lib/query-client";
import { useI18n } from "../../../../../lib/i18n/context";
import { cn } from "../../../../../lib/utils";

export interface ProductLocalesFormProps {
  ws: string;
  product: ProductDetail;
}

interface LocaleSwapPreviewStats {
  changelog: { total: number; promoted: number; fallback: number };
  faq: { total: number; promoted: number; fallback: number };
  roadmap: { total: number; promoted: number; fallback: number };
}

function ProductLocalesFormInner({
  ws,
  product,
}: ProductLocalesFormProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useI18n();

  const initialDefault = product.locales?.defaultLocale ?? DEFAULT_LOCALE;
  const initialEnabled =
    product.locales?.enabledLocales && product.locales.enabledLocales.length > 0
      ? product.locales.enabledLocales
      : [DEFAULT_LOCALE];

  const [defaultLocale, setDefaultLocale] = React.useState<SupportedLocale>(initialDefault);
  const [enabledLocales, setEnabledLocales] = React.useState<SupportedLocale[]>(initialEnabled);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewStats, setPreviewStats] = React.useState<LocaleSwapPreviewStats | null>(null);

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
      toast.success(t("dashboard.languagesSaved") || "Languages saved");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enabledLocales.includes(defaultLocale)) {
      setErrorMsg(t("ui.defaultMustBeEnabled") || "Default language must be enabled.");
      return;
    }
    setErrorMsg(null);

    // If defaultLocale changed, fetch preview and open confirmation dialog
    if (defaultLocale !== initialDefault) {
      setIsPreviewLoading(true);
      try {
        const stats = await apiFetch<LocaleSwapPreviewStats>(
          `/api/v1/workspaces/${ws}/products/${product.slug}/locales/swap-preview?target=${defaultLocale}`,
        );
        setPreviewStats(stats);
        setIsConfirmOpen(true);
      } catch (err) {
        toast.error(errorCopy(err));
      } finally {
        setIsPreviewLoading(false);
      }
      return;
    }

    mutation.mutate({
      locales: {
        defaultLocale,
        enabledLocales,
      },
    });
  };

  const handleConfirmSwap = () => {
    setIsConfirmOpen(false);
    mutation.mutate({
      locales: {
        defaultLocale,
        enabledLocales,
      },
    });
  };

  const oldMeta = LOCALE_CATALOG[initialDefault];
  const newMeta = LOCALE_CATALOG[defaultLocale];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Globe className="size-4 text-foreground/70" aria-hidden="true" />
              {t("dashboard.languagesAndLocales") || "Languages & Localization"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("ui.languagesDescription") ||
                "Manage languages available on this product's public portal and content entries."}
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
            {t("dashboard.defaultLanguage") || "Default language"}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("ui.defaultLanguageHint") ||
              "This language is used as fallback when translations are missing or no language is detected."}
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
            className="h-9 px-3 py-1.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs cursor-pointer"
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
            {t("dashboard.enabledLanguages") || "Enabled languages"}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("ui.enabledLanguagesHint") ||
              "Select which languages are available in the public portal switcher and entry editors."}
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
            disabled={!isDirty || mutation.isPending || isPreviewLoading}
            className="min-w-24"
          >
            {mutation.isPending || isPreviewLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin mr-2" />
                {t("common.saving") || "Saving..."}
              </>
            ) : (
              t("ui.saveChanges") || "Save changes"
            )}
          </Button>
        </div>
      </form>

      {/* Confirmation & Impact Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ArrowRightLeft className="size-5 text-primary shrink-0" />
              <span>Change Default Language</span>
            </DialogTitle>
            <DialogDescription>
              Switching the product default language from{" "}
              <strong className="text-foreground">{oldMeta?.name}</strong> to{" "}
              <strong className="text-foreground">{newMeta?.name}</strong> will update existing entries in an atomic transaction:
            </DialogDescription>
          </DialogHeader>

          {previewStats && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Impact Summary</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>Changelog:</span>
                    <span className="font-mono text-foreground">
                      {previewStats.changelog.promoted} promoted &bull; {previewStats.changelog.fallback} fallback
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>FAQ:</span>
                    <span className="font-mono text-foreground">
                      {previewStats.faq.promoted} promoted &bull; {previewStats.faq.fallback} fallback
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Roadmap:</span>
                    <span className="font-mono text-foreground">
                      {previewStats.roadmap.promoted} promoted &bull; {previewStats.roadmap.fallback} fallback
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Existing {newMeta?.name} translations will become the main fields. Untranslated entries will preserve their original language and be shown with an original fallback badge on the portal.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSwap}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Confirm & Swap"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductLocalesForm(props: ProductLocalesFormProps): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductLocalesFormInner {...props} />
    </QueryProvider>
  );
}
