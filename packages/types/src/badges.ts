import { z } from "zod";

export const BADGE_NAME_MAX = 50;
export const BADGE_SLUG_MAX = 50;
export const BADGE_DESC_MAX = 200;
export const RULE_PARAM_KEY_MAX = 100;
export const RULE_MATCH_VALUE_MAX = 500;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const BadgeRuleMatchTypeSchema = z.enum(["exact", "regex"]);
export type BadgeRuleMatchType = z.infer<typeof BadgeRuleMatchTypeSchema>;

export const BadgeRuleSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  badgeId: z.string().uuid(),
  paramKey: z.string(),
  matchType: BadgeRuleMatchTypeSchema,
  matchValue: z.string(),
  hasSecretToken: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BadgeRule = z.infer<typeof BadgeRuleSchema>;

export const CreateBadgeRuleInputSchema = z.object({
  paramKey: z.string().trim().min(1).max(RULE_PARAM_KEY_MAX),
  matchType: BadgeRuleMatchTypeSchema.default("exact"),
  matchValue: z.string().trim().min(1).max(RULE_MATCH_VALUE_MAX),
  secretToken: z.string().trim().max(255).optional(),
});
export type CreateBadgeRuleInput = z.infer<typeof CreateBadgeRuleInputSchema>;

export const BadgeSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  color: z.string(),
  textColor: z.string(),
  icon: z.string().nullable().optional(),
  priority: z.number().int(),
  isActive: z.boolean(),
  rulesCount: z.number().int().optional(),
  rules: z.array(BadgeRuleSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Badge = z.infer<typeof BadgeSchema>;

export const CreateBadgeInputSchema = z.object({
  name: z.string().trim().min(1).max(BADGE_NAME_MAX),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(BADGE_SLUG_MAX)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  description: z.string().trim().max(BADGE_DESC_MAX).optional(),
  color: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color like #0284c7").default("#0284c7"),
  textColor: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color like #ffffff").default("#ffffff"),
  icon: z.string().trim().max(50).nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});
export type CreateBadgeInput = z.infer<typeof CreateBadgeInputSchema>;

export const UpdateBadgeInputSchema = z.object({
  name: z.string().trim().min(1).max(BADGE_NAME_MAX).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(BADGE_SLUG_MAX)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().trim().max(BADGE_DESC_MAX).nullable().optional(),
  color: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color").optional(),
  textColor: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color").optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBadgeInput = z.infer<typeof UpdateBadgeInputSchema>;

export const UserProductBadgeItemSchema = z.object({
  id: z.string().uuid(),
  badgeId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  color: z.string(),
  textColor: z.string(),
  icon: z.string().nullable().optional(),
  priority: z.number().int(),
  source: z.enum(["rule", "manual"]),
  grantedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
});
export type UserProductBadgeItem = z.infer<typeof UserProductBadgeItemSchema>;

export const ProductUserListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  badges: z.array(UserProductBadgeItemSchema),
  postsCount: z.number().int(),
  commentsCount: z.number().int(),
  votesCount: z.number().int(),
  firstSeenAt: z.string(),
  lastActiveAt: z.string(),
});
export type ProductUserListItem = z.infer<typeof ProductUserListItemSchema>;

export const ProductUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  badgeId: z.string().uuid().optional(),
});
export type ProductUsersQuery = z.infer<typeof ProductUsersQuerySchema>;

export const AssignUserBadgeInputSchema = z.object({
  badgeId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type AssignUserBadgeInput = z.infer<typeof AssignUserBadgeInputSchema>;

export const PublicBadgeChipSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  color: z.string(),
  textColor: z.string(),
  icon: z.string().nullable().optional(),
  priority: z.number().int(),
});
export type PublicBadgeChip = z.infer<typeof PublicBadgeChipSchema>;
