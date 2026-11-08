import { and, eq, inArray, isNull } from "drizzle-orm";
import { products, type Db } from "@userhq/db";
import { productRestrictionsInputSchema } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

/** Classify key credentials before considering any accompanying session cookie. */
export function apiKeyToken(authorization: unknown): string | null {
  if (typeof authorization !== "string") return null;
  const match = /^Bearer[ \t]+(uhq_live_.*)$/i.exec(authorization);
  return match ? match[1].trim() : null;
}

/**
 * The one product-access rule for stored restrictions (API keys and webhook subscriptions).
 * null/undefined = every product; a list = exactly those products; an empty or malformed value = none.
 */
export function isProductAllowed(restrictions: unknown, productId: string | null | undefined): boolean {
  if (restrictions === null || restrictions === undefined) return true;
  const parsed = productRestrictionsInputSchema.safeParse(restrictions);
  return parsed.success && !!productId && parsed.data?.includes(productId) === true;
}

/**
 * Write-path normaliser: null for "unrestricted", otherwise the deduped ids, all of which must be live
 * products of this workspace. Foreign, deleted and unknown ids are indistinguishable to the caller.
 */
export async function resolveProductRestrictions(
  db: Db,
  workspaceId: string,
  input: string[] | null | undefined
): Promise<string[] | null> {
  if (input === null || input === undefined) return null;
  const ids = [...new Set(input)];
  const found = ids.length
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.workspaceId, workspaceId), inArray(products.id, ids), isNull(products.deletedAt)))
    : [];
  if (ids.length === 0 || found.length !== ids.length) {
    throw new ApiException("validation_failed", 400, "productRestrictions must list only existing products of this workspace.");
  }
  return ids;
}
