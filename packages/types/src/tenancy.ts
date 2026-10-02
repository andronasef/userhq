import { z } from "zod";

export const PublicPortalProductSchema = z.object({
  workspace: z.object({
    slug: z.string(),
    name: z.string(),
  }),
  product: z.object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string().nullable(),
    accentColor: z.string(),
    logoUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
  }),
});
export type PublicPortalProduct = z.infer<typeof PublicPortalProductSchema>;
