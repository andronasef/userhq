import type { ProductFeatures } from "@userhq/types";

export function landingHref(ws: string, product: string, _features: ProductFeatures): string | null {
  return `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
}

export function portalTabs(ws: string, product: string, _features: ProductFeatures, hasUser: boolean) {
  const base = `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
  return [
    { label: "Feedback", href: base },
    { label: "Roadmap", href: `${base}/roadmap` },
    { label: "Changelog", href: `${base}/changelog` },
    { label: "FAQ", href: `${base}/faq` },
    ...(hasUser ? [{ label: "Activity", href: `${base}/activity` }] : []),
  ];
}

export function portalDescription(name: string, _workspaceName: string, _features: ProductFeatures): string {
  return `Share feedback, vote on ideas, and follow what's coming next for ${name}.`;
}
