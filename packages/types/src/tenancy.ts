import { z } from "zod";
import { workspaceSlugSchema } from "./slugs.js";
import { PublicUserSchema } from "./user.js";

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

export const NameSchema = z
  .string()
  .trim()
  .min(1, { message: "name_required" })
  .max(50, { message: "name_too_long" });

export const CreateWorkspaceInputSchema = z.object({
  name: NameSchema,
  slug: workspaceSlugSchema,
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const WorkspaceCreatedSchema = z.object({
  slug: z.string(),
});
export type WorkspaceCreated = z.infer<typeof WorkspaceCreatedSchema>;

export const MemberRoleSchema = z.enum(["owner", "admin"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const WorkspaceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  role: MemberRoleSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const MeWorkspaceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  role: MemberRoleSchema,
});
export type MeWorkspace = z.infer<typeof MeWorkspaceSchema>;

export const MeResponseSchema = z.object({
  user: PublicUserSchema.nullable(),
  isPlatformOwner: z.boolean(),
  canCreateWorkspace: z.boolean(),
  workspaces: z.array(MeWorkspaceSchema),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const ANONYMOUS_ME: MeResponse = {
  user: null,
  isPlatformOwner: false,
  canCreateWorkspace: false,
  workspaces: [],
};
