import { z } from "zod";

export const API_KEY_SCOPES = [
  "admin",
  "requests:read",
  "requests:write",
  "comments:read",
  "comments:write",
  "roadmap:read",
  "roadmap:write",
  "changelog:read",
  "changelog:write",
  "export:read",
  "webhooks:read",
  "webhooks:write",
  "settings:read",
  "settings:write",
  "faq:read",
  "faq:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  scopes: z
    .array(apiKeyScopeSchema)
    .min(1, "At least one scope must be selected"),
  productRestrictions: z.array(z.string().uuid()).nullable().optional(),
  expiresInDays: z
    .number()
    .int()
    .positive()
    .max(3650, "Expiration cannot exceed 10 years")
    .nullable()
    .optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const apiKeyMetadataSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  productRestrictions: z.array(z.string().uuid()).nullable(),
  createdByUserId: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApiKeyMetadata = z.infer<typeof apiKeyMetadataSchema>;

export const createdApiKeyResponseSchema = z.object({
  key: apiKeyMetadataSchema,
  token: z.string(), // Full unhashed token: only displayed once
});

export type CreatedApiKeyResponse = z.infer<typeof createdApiKeyResponseSchema>;

export const apiKeyListResponseSchema = z.object({
  keys: z.array(apiKeyMetadataSchema),
});

export type ApiKeyListResponse = z.infer<typeof apiKeyListResponseSchema>;

/** Public shape of "which integration made this": never carries the key id. */
export const IntegrationSourceSchema = z.object({
  kind: z.literal("integration"),
  name: z.string(),
});
export type IntegrationSource = z.infer<typeof IntegrationSourceSchema>;

/** Admin-only shape: adds the key id. */
export const AdminIntegrationSourceSchema = IntegrationSourceSchema.extend({
  apiKeyId: z.string().uuid(),
});
export type AdminIntegrationSource = z.infer<typeof AdminIntegrationSourceSchema>;

/** Sliding-window limit applied to every request authenticated by one API key. */
export const API_KEY_RATE_LIMIT = { limit: 120, windowSeconds: 60 } as const;
