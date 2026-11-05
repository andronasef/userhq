"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { ProductFeatures } from "@userhq/types";
import { portalTabs } from "../../lib/portal-features";
import { TabNav } from "../tab-nav";

export interface PortalTabsProps {
  ws: string;
  product: string;
  hasUser: boolean;
  features: ProductFeatures;
}

export function PortalTabs({ ws, product, hasUser, features }: PortalTabsProps): React.JSX.Element | null {
  const pathname = usePathname();
  const baseHref = `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
  const roadmapHref = `${baseHref}/roadmap`;
  const changelogHref = `${baseHref}/changelog`;
  const faqHref = `${baseHref}/faq`;
  const activityHref = `${baseHref}/activity`;

  const tabs = portalTabs(ws, product, features, hasUser);
  if (tabs.length < 2) return null;

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
