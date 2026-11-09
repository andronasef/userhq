import { z } from "zod";

export const BADGE_NAME_MAX = 50;
export const BADGE_SLUG_MAX = 50;
export const BADGE_DESC_MAX = 200;
export const RULE_PARAM_KEY_MAX = 100;
export const RULE_MATCH_VALUE_MAX = 256;
export const RULE_REGEX_MAX = 200;
export const ATTRIBUTE_MAX_PARAMS = 50;
export const ATTRIBUTE_PARAM_VALUE_MAX = 256;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const BadgeRuleMatchTypeSchema = z.enum(["exact", "regex"]);
export type BadgeRuleMatchType = z.infer<typeof BadgeRuleMatchTypeSchema>;

export const BadgeRuleSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  badgeId: z.string().uuid(),
  paramKey: z.string(),
  keyMatchType: BadgeRuleMatchTypeSchema,
  matchType: BadgeRuleMatchTypeSchema,
  matchValue: z.string(),
  hasSecretToken: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BadgeRule = z.infer<typeof BadgeRuleSchema>;

export const CreateBadgeRuleInputSchema = z
  .object({
    keyMatchType: BadgeRuleMatchTypeSchema.default("exact"),
    paramKey: z.string().trim().min(1).max(RULE_REGEX_MAX),
    matchType: BadgeRuleMatchTypeSchema.default("exact"),
    matchValue: z.string().trim().min(1).max(RULE_MATCH_VALUE_MAX),
    secretToken: z.string().trim().max(255).optional(),
  })
  .superRefine((rule, ctx) => {
    if (
      rule.keyMatchType === "exact" &&
      (rule.paramKey.length > RULE_PARAM_KEY_MAX ||
        /_(sig|ts)$/.test(rule.paramKey))
    )
      ctx.addIssue({
        code: "custom",
        path: ["paramKey"],
        message: "Invalid or reserved parameter name",
      });
    if (rule.matchType === "regex" && rule.matchValue.length > RULE_REGEX_MAX)
      ctx.addIssue({
        code: "custom",
        path: ["matchValue"],
        message: "Regex pattern is too long",
      });
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
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must only contain lowercase letters, numbers, and hyphens",
    ),
  description: z.string().trim().max(BADGE_DESC_MAX).optional(),
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color like #0284c7")
    .default("#0284c7"),
  textColor: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color like #ffffff")
    .default("#ffffff"),
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
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must only contain lowercase letters, numbers, and hyphens",
    )
    .optional(),
  description: z.string().trim().max(BADGE_DESC_MAX).nullable().optional(),
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color")
    .optional(),
  textColor: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color")
    .optional(),
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

export const AttributeInputSchema = z.object({
  searchParams: z
    .record(
      z.string().max(RULE_PARAM_KEY_MAX),
      z.string().max(ATTRIBUTE_PARAM_VALUE_MAX),
    )
    .refine(
      (params) => Object.keys(params).length <= ATTRIBUTE_MAX_PARAMS,
      "Too many parameters",
    ),
});
export type AttributeInput = z.infer<typeof AttributeInputSchema>;
export const AttributeResponseSchema = z.object({
  matchedBadges: z.array(PublicBadgeChipSchema),
  scrubKeys: z.array(z.string()),
});
export type AttributeResponse = z.infer<typeof AttributeResponseSchema>;

export const BadgeListResponseSchema = z.object({
  items: z.array(BadgeSchema),
});
export type BadgeListResponse = z.infer<typeof BadgeListResponseSchema>;
export const ProductUsersResponseSchema = z.object({
  items: z.array(ProductUserListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type ProductUsersResponse = z.infer<typeof ProductUsersResponseSchema>;
export const AssignUserBadgeResponseSchema = z.object({
  success: z.literal(true),
});
export type AssignUserBadgeResponse = z.infer<
  typeof AssignUserBadgeResponseSchema
>;
