import { z } from "zod";
import { slugify } from "./slugs.js";
import { STATUS_TYPES } from "./palette.js";

export const POST_TITLE_MIN = 3;
export const POST_TITLE_MAX = 120;
export const POST_BODY_MAX = 5000;
export const COMMENT_BODY_MAX = 5000;
export const STATUS_NOTE_MAX = 1000;
export const CATEGORY_NAME_MAX = 30;
export const SEARCH_QUERY_MAX = 100;
export const POST_SLUG_MAX = 60;
export const BOARD_PAGE_SIZE = 20;
export const ADMIN_PAGE_SIZE = 50;

export function postSlug(title: string): string {
  return slugify(title, POST_SLUG_MAX);
}

export const PostTitleSchema = z
  .string({ message: "title_required" })
  .transform((val) => val.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "title_required" })
      .min(POST_TITLE_MIN, { message: "title_too_short" })
      .max(POST_TITLE_MAX, { message: "title_too_long" })
  );

export const PostDescriptionSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(
    z.string().max(POST_BODY_MAX, { message: "description_too_long" }).nullable()
  );

export const CreatePostInputSchema = z.object({
  title: PostTitleSchema,
  description: PostDescriptionSchema.optional().default(null),
});
export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

export const PostCreatedSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
});
export type PostCreated = z.infer<typeof PostCreatedSchema>;

export const PublicAuthorSchema = z.object({
  name: z.string().nullable(),
  image: z.string().nullable(),
  isAdmin: z.boolean(),
  deleted: z.boolean(),
});
export type PublicAuthor = z.infer<typeof PublicAuthorSchema>;

export const PostStatusSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  type: z.enum(STATUS_TYPES),
});
export type PostStatus = z.infer<typeof PostStatusSchema>;

export const PostCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type PostCategory = z.infer<typeof PostCategorySchema>;

export const PublicPostRowSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  voteCount: z.number().int(),
  voted: z.boolean(),
  commentCount: z.number().int(),
  createdAt: z.string(),
  status: PostStatusSchema,
  category: PostCategorySchema.nullable(),
});
export type PublicPostRow = z.infer<typeof PublicPostRowSchema>;

export const BoardQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(SEARCH_QUERY_MAX)
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  sort: z.enum(["top", "new", "match"]).optional(),
  category: z.string().uuid().optional(),
  status: z.union([z.literal("all"), z.string().uuid()]).optional(),
  cursor: z.string().max(200).optional(),
});
export type BoardQuery = z.infer<typeof BoardQuerySchema>;

export const PublicBoardPageSchema = z.object({
  posts: z.array(PublicPostRowSchema),
  nextCursor: z.string().nullable(),
});
export type PublicBoardPage = z.infer<typeof PublicBoardPageSchema>;

export const PostViewerSchema = z.object({
  signedIn: z.boolean(),
  voted: z.boolean(),
  isAuthor: z.boolean(),
  isAdmin: z.boolean(),
  inConversation: z.boolean(),
  muted: z.boolean(),
  commentEmailsOn: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type PostViewer = z.infer<typeof PostViewerSchema>;

export const PublicPostDetailSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  voteCount: z.number().int(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  version: z.number().int(),
  status: PostStatusSchema,
  category: PostCategorySchema.nullable(),
  author: PublicAuthorSchema,
});
export type PublicPostDetail = z.infer<typeof PublicPostDetailSchema>;

export const PublicPostPageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("post"),
    post: PublicPostDetailSchema,
    viewer: PostViewerSchema,
  }),
  z.object({
    kind: z.literal("redirect"),
    number: z.number().int().positive(),
    slug: z.string(),
  }),
]);
export type PublicPostPage = z.infer<typeof PublicPostPageSchema>;

export const VoteResultSchema = z.object({
  voted: z.boolean(),
  voteCount: z.number().int(),
});
export type VoteResult = z.infer<typeof VoteResultSchema>;
