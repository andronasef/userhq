"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { TabNav } from "../tab-nav";

export interface PortalTabsProps {
  ws: string;
  product: string;
  hasUser: boolean;
}

export function PortalTabs({ ws, product, hasUser }: PortalTabsProps): React.JSX.Element {
  const pathname = usePathname();
  const baseHref = `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
  const roadmapHref = `${baseHref}/roadmap`;
  const changelogHref = `${baseHref}/changelog`;
  const faqHref = `${baseHref}/faq`;
  const activityHref = `${baseHref}/activity`;

  const tabs = [
    { label: "Feedback", href: baseHref },
    { label: "Roadmap", href: roadmapHref },
    { label: "Changelog", href: changelogHref },
    { label: "FAQ", href: faqHref },
    ...(hasUser ? [{ label: "Activity", href: activityHref }] : []),
  ];

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
