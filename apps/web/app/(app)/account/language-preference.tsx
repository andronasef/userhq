"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { LOCALE_CATALOG, type SupportedLocale } from "@userhq/types";
import { useI18n } from "@/lib/i18n/context";
import { NativeSelect } from "@/components/ui/native-select";

export function LanguagePreference(): React.JSX.Element {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as SupportedLocale;
    if (newLocale && newLocale in LOCALE_CATALOG) {
      setLocale(newLocale);
      router.refresh();
      toast.success(t("dashboard.languagesSaved", "Language preferences updated"));
    }
  };

  const description =
    locale === "ar"
      ? "اختر لغة العرض المفضلة لواجهة مستخدم UserHQ."
      : locale === "fr"
      ? "Choisissez votre langue préférée pour l'interface de UserHQ."
      : locale === "es"
      ? "Elige tu idioma preferido para la interfaz de UserHQ."
      : locale === "de"
      ? "Wählen Sie Ihre bevorzugte Sprache für die UserHQ-Oberfläche."
      : "Choose your preferred language for the UserHQ interface.";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">
          {t("common.language", "Language")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {description}
      </p>

      <div className="max-w-xs">
        <NativeSelect
          value={locale}
          onChange={handleChange}
          aria-label={t("common.language", "Language")}
        >
          {Object.values(LOCALE_CATALOG).map((item) => (
            <option key={item.code} value={item.code}>
              {item.nativeName} ({item.name})
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
