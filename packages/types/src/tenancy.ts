import { z } from "zod";
import { workspaceSlugSchema, productSlugSchema } from "./slugs.js";
import { PublicUserSchema } from "./user.js";
import { HEX_COLOR_RE, STATUS_TYPES } from "./palette.js";

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

export const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_RE, { message: "invalid_color" })
  .transform((s) => s.toUpperCase());
export type HexColor = z.infer<typeof HexColorSchema>;

export const WebsiteUrlSchema = z
  .string()
  .trim()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .refine(
    (val) => {
      if (val === null) return true;
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== "https:") return false;
        const host = parsed.hostname;
        if (!host || host.startsWith(".") || host.endsWith(".")) return false;
        const parts = host.split(".");
        if (parts.length < 2) return false;
        return parts.every((p) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(p));
      } catch {
        return false;
      }
    },
    { message: "invalid_url" }
  );
export type WebsiteUrl = z.infer<typeof WebsiteUrlSchema>;

export const TaglineSchema = z
  .string()
  .trim()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .refine((val) => val === null || val.length <= 80, {
    message: "tagline_too_long",
  });
export type Tagline = z.infer<typeof TaglineSchema>;

export const CreateProductInputSchema = z.object({
  name: NameSchema,
  slug: productSlugSchema,
  logoUploadId: z.uuid().nullable().optional(),
});
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const ProductCreatedSchema = z.object({
  slug: z.string(),
});
export type ProductCreated = z.infer<typeof ProductCreatedSchema>;

export const ProductSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  accentColor: z.string(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const ProductDetailSchema = ProductSummarySchema.extend({
  logoUploadId: z.uuid().nullable(),
  tagline: z.string().nullable(),
  websiteUrl: z.string().nullable(),
});
export type ProductDetail = z.infer<typeof ProductDetailSchema>;

export const UpdateProductInputSchema = z.object({
  name: NameSchema.optional(),
  logoUploadId: z.uuid().nullable().optional(),
  tagline: TaglineSchema.optional(),
  websiteUrl: WebsiteUrlSchema.optional(),
  accentColor: HexColorSchema.optional(),
});
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.literal("up"),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const StatusNameSchema = z
  .string()
  .trim()
  .min(1, { message: "name_required" })
  .max(30, { message: "name_too_long" });
export type StatusName = z.infer<typeof StatusNameSchema>;

export const StatusTypeSchema = z.enum(STATUS_TYPES);

export const StatusSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
  type: StatusTypeSchema,
  position: z.number().int(),
  isDefault: z.boolean(),
});
export type Status = z.infer<typeof StatusSchema>;

export const CreateStatusInputSchema = z.object({
  name: StatusNameSchema,
  type: StatusTypeSchema,
  color: HexColorSchema,
});
export type CreateStatusInput = z.infer<typeof CreateStatusInputSchema>;

export const UpdateStatusInputSchema = CreateStatusInputSchema.partial();
export type UpdateStatusInput = z.infer<typeof UpdateStatusInputSchema>;

export const ReorderStatusesInputSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});
export type ReorderStatusesInput = z.infer<typeof ReorderStatusesInputSchema>;
