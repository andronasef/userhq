import { z } from "zod";
import { RichTextDocSchema } from "./rich-text.js";

export const CHANGELOG_TITLE_MIN = 3;
export const CHANGELOG_TITLE_MAX = 150;
export const CHANGELOG_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SEEDED_CHANGELOG_TAGS = [
  { name: "New", color: "#10B981" },
  { name: "Improved", color: "#3B82F6" },
  { name: "Fixed", color: "#F59E0B" },
] as const;

export const ChangelogTitleSchema = z
  .string({ message: "title_required" })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "title_required" })
      .min(CHANGELOG_TITLE_MIN, { message: "title_length" })
      .max(CHANGELOG_TITLE_MAX, { message: "title_length" })
  );

export const ChangelogSlugSchema = z
  .string({ message: "slug_required" })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, { message: "slug_required" })
      .regex(CHANGELOG_SLUG_REGEX, { message: "slug_format" })
  );

export const ChangelogTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type ChangelogTag = z.infer<typeof ChangelogTagSchema>;

export const ChangelogTagInputSchema = z.object({
  name: z
    .string({ message: "name_required" })
    .trim()
    .min(1, { message: "name_required" })
    .max(30, { message: "name_too_long" }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "invalid_color" }),
});
export type ChangelogTagInput = z.infer<typeof ChangelogTagInputSchema>;

export const AdminChangelogEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  content: RichTextDocSchema,
  publishedAt: z.string().nullable(), // ISO string or null
  tags: z.array(ChangelogTagSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminChangelogEntry = z.infer<typeof AdminChangelogEntrySchema>;

export const AdminChangelogListResponseSchema = z.object({
  entries: z.array(AdminChangelogEntrySchema),
  tags: z.array(ChangelogTagSchema),
});
export type AdminChangelogListResponse = z.infer<typeof AdminChangelogListResponseSchema>;

export const PublicChangelogEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  content: RichTextDocSchema,
  publishedAt: z.string(), // Always non-null on public portal
  tags: z.array(ChangelogTagSchema),
  createdAt: z.string(),
});
export type PublicChangelogEntry = z.infer<typeof PublicChangelogEntrySchema>;

export const CHANGELOG_PAGE_SIZE = 10;

export const PublicChangelogFeedResponseSchema = z.object({
  entries: z.array(PublicChangelogEntrySchema),
  nextCursor: z.string().nullable(),
});
export type PublicChangelogFeedResponse = z.infer<typeof PublicChangelogFeedResponseSchema>;

export const CreateChangelogEntryInputSchema = z.object({
  title: ChangelogTitleSchema,
  slug: ChangelogSlugSchema.optional(),
  summary: z.string().max(500).optional(),
  content: RichTextDocSchema,
  tagIds: z.array(z.string().uuid()).default([]),
  publishedAt: z.string().nullable().optional(), // If provided upon creation
});
export type CreateChangelogEntryInput = z.infer<typeof CreateChangelogEntryInputSchema>;

export const UpdateChangelogEntryInputSchema = z.object({
  title: ChangelogTitleSchema.optional(),
  slug: ChangelogSlugSchema.optional(),
  summary: z.string().max(500).nullable().optional(),
  content: RichTextDocSchema.optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  publishedAt: z.string().nullable().optional(),
});
export type UpdateChangelogEntryInput = z.infer<typeof UpdateChangelogEntryInputSchema>;

export const PublishChangelogEntryInputSchema = z.object({
  publishedAt: z.string().optional(), // Optional custom / backdated release date (D-13)
});
export type PublishChangelogEntryInput = z.infer<typeof PublishChangelogEntryInputSchema>;
