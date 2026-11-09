"use client";

import * as React from "react";
import type { ProductLocalesConfig } from "@userhq/types";
import { useI18n } from "../../lib/i18n/context";

/** Restricts the visitor's language to the product's enabled languages. */
export function PortalLocaleScope({ locales }: { locales?: ProductLocalesConfig }): null {
  const { setScope } = useI18n();
  const defaultLocale = locales?.defaultLocale;
  const key = locales?.enabledLocales.join(",");
  React.useEffect(() => {
    if (!locales) return;
    setScope({ defaultLocale: locales.defaultLocale, enabledLocales: locales.enabledLocales });
    return () => setScope(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLocale, key, setScope]);
  return null;
}
