import { SetMetadata } from "@nestjs/common";
import { products } from "@userhq/db";
import { PRODUCT_FEATURE_KEYS, type ProductFeatures } from "@userhq/types";

type ProductFeatureKey = keyof ProductFeatures;

/** Which product capability a portal controller/handler belongs to, or `exempt` (branding metadata only). */
export type PortalFeatureSetting = ProductFeatureKey | "exempt";

export const PORTAL_FEATURE = "portalFeature";
export const PortalFeature = (setting: PortalFeatureSetting) =>
  SetMetadata(PORTAL_FEATURE, setting);

/** Typed column map: spread into a `select({...})` to resolve the capability flags. */
export const productFeatureColumns = {
  board: products.boardEnabled,
  roadmap: products.roadmapEnabled,
  changelog: products.changelogEnabled,
  faq: products.faqEnabled,
} as const satisfies Record<ProductFeatureKey, unknown>;

const SETTINGS: readonly string[] = [...PRODUCT_FEATURE_KEYS, "exempt"];

/** Reduce a row selected with `productFeatureColumns` to just the capability object. */
export function pickFeatures(row: ProductFeatures): ProductFeatures {
  return Object.fromEntries(PRODUCT_FEATURE_KEYS.map((key) => [key, row[key]])) as ProductFeatures;
}

export function isPortalFeatureSetting(value: unknown): value is PortalFeatureSetting {
  return typeof value === "string" && SETTINGS.includes(value);
}

/** Pure predicate, usable without HTTP (guard, projections, workers). */
export function featureEnabled(features: ProductFeatures, setting: PortalFeatureSetting): boolean {
  return setting === "exempt" || features[setting];
}
