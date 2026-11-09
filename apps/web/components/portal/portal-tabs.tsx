"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { ProductFeatures } from "@userhq/types";
import { portalTabs } from "../../lib/portal-features";
import { useI18n } from "../../lib/i18n/context";
import { TabNav } from "../tab-nav";

export interface PortalTabsProps {
  ws: string;
  product: string;
  hasUser: boolean;
  features: ProductFeatures;
}

export function PortalTabs({ ws, product, hasUser, features }: PortalTabsProps): React.JSX.Element | null {
  const pathname = usePathname();
  const { t } = useI18n();
  const baseHref = `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
  const roadmapHref = `${baseHref}/roadmap`;
  const changelogHref = `${baseHref}/changelog`;
  const faqHref = `${baseHref}/faq`;
  const activityHref = `${baseHref}/activity`;

  const rawTabs = portalTabs(ws, product, features, hasUser);
  if (rawTabs.length < 2) return null;

  const tabs = rawTabs.map((tab) => {
    let localizedLabel = tab.label;
    if (tab.label === "Feedback") localizedLabel = t("ui.feedback");
    else if (tab.label === "Roadmap") localizedLabel = t("nav.roadmap");
    else if (tab.label === "Changelog") localizedLabel = t("nav.changelog");
    else if (tab.label === "FAQ") localizedLabel = t("nav.faq");
    else if (tab.label === "Activity") localizedLabel = t("nav.activity");
    return { ...tab, label: localizedLabel };
  });

  let activeHref = baseHref;
  if (pathname.startsWith(roadmapHref)) {
    activeHref = roadmapHref;
  } else if (pathname.startsWith(changelogHref)) {
    activeHref = changelogHref;
  } else if (pathname.startsWith(faqHref)) {
    activeHref = faqHref;
  } else if (pathname.startsWith(activityHref)) {
    activeHref = activityHref;
  }

  return <TabNav tabs={tabs} activeHref={activeHref} />;
}
