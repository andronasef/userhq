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
  logoUploadId: z.uuid().nullable().optional(),
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

export const INVITE_TTL_DAYS = 7;

export const InviteStateSchema = z.enum(["pending", "used", "expired", "revoked"]);
export type InviteState = z.infer<typeof InviteStateSchema>;

export const CreateInviteInputSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ message: "invalid_email" }))
    .transform((s) => s.toLowerCase()),
});
export type CreateInviteInput = z.infer<typeof CreateInviteInputSchema>;

export const InviteCreatedSchema = z.object({
  link: z.string(),
  email: z.string(),
  expiresAt: z.string(),
});
export type InviteCreated = z.infer<typeof InviteCreatedSchema>;

export const InviteRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  state: InviteStateSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  usedByName: z.string().nullable(),
  workspaceName: z.string().nullable(),
});
export type InviteRow = z.infer<typeof InviteRowSchema>;

export const InviteLookupSchema = z.object({
  kind: z.enum(["platform", "workspace"]),
  state: InviteStateSchema,
  emailMatches: z.boolean(),
  maskedEmail: z.string().nullable(),
  workspaceName: z.string().nullable(),
  workspaceSlug: z.string().nullable(),
  alreadyMember: z.boolean(),
  workspaceSuspended: z.boolean(),
});
export type InviteLookup = z.infer<typeof InviteLookupSchema>;

export const MemberRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: MemberRoleSchema,
  joinedAt: z.string(),
});
export type MemberRow = z.infer<typeof MemberRowSchema>;

export const AcceptInviteResultSchema = z.object({
  workspaceSlug: z.string(),
});
export type AcceptInviteResult = z.infer<typeof AcceptInviteResultSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.literal("up"),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
