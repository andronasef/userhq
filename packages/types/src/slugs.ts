import { z } from "zod";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 32;

export const RESERVED_WORKSPACE_SLUGS = [
  "api",
  "dashboard",
  "login",
  "uploads",
  "platform",
  "invite",
  "dev",
  "new",
  "account",
  "settings",
  "admin",
  "auth",
  "help",
] as const;

export const RESERVED_PRODUCT_SLUGS = [
  "new",
  "team",
  "settings",
] as const;

export function slugify(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const sliced = normalized.slice(0, SLUG_MAX_LENGTH);
  return sliced.replace(/-+$/, "");
}

export const workspaceSlugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH, { message: "slug_invalid" })
  .max(SLUG_MAX_LENGTH, { message: "slug_invalid" })
  .regex(SLUG_RE, { message: "slug_invalid" })
  .refine(
    (slug) => !RESERVED_WORKSPACE_SLUGS.includes(slug as (typeof RESERVED_WORKSPACE_SLUGS)[number]),
    { message: "slug_reserved" }
  );

export const productSlugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH, { message: "slug_invalid" })
  .max(SLUG_MAX_LENGTH, { message: "slug_invalid" })
  .regex(SLUG_RE, { message: "slug_invalid" })
  .refine(
    (slug) => !RESERVED_PRODUCT_SLUGS.includes(slug as (typeof RESERVED_PRODUCT_SLUGS)[number]),
    { message: "slug_reserved" }
  );
