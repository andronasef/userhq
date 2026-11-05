import type { ProductFeatures } from "@userhq/types";

export function landingHref(ws: string, product: string, features: ProductFeatures): string | null {
  return portalTabs(ws, product, features, false)[0]?.href ?? null;
}

export function portalTabs(ws: string, product: string, features: ProductFeatures, hasUser: boolean) {
  const base = `/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`;
  return [
    ...(features.board ? [{ label: "Feedback", href: base }] : []),
    ...(features.roadmap ? [{ label: "Roadmap", href: `${base}/roadmap` }] : []),
    ...(features.changelog ? [{ label: "Changelog", href: `${base}/changelog` }] : []),
    ...(features.faq ? [{ label: "FAQ", href: `${base}/faq` }] : []),
    ...(features.board && hasUser ? [{ label: "Activity", href: `${base}/activity` }] : []),
  ];
}

export function portalDescription(name: string, workspaceName: string, features: ProductFeatures): string {
  if (features.board && features.roadmap) return `Share feedback, vote on ideas, and follow what's coming next for ${name}.`;
  if (features.board) return `Share feedback and vote on ideas for ${name}.`;
  if (features.roadmap) return `See what's planned for ${name}.`;
  if (features.changelog) return `Read what's new in ${name}.`;
  if (features.faq) return `Find answers to common questions about ${name}.`;
  return `${name} from ${workspaceName}.`;
}
