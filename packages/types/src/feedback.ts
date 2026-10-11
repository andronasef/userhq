import { PostRoadmapItemRefSchema } from "./roadmap.js";
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

export const CategoryNameSchema = z
  .string({ message: "name_required" })
  .transform((val) => val.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "name_required" })
      .max(CATEGORY_NAME_MAX, { message: "category_name_too_long" })
  );

export const CategoryInputSchema = z.object({
  name: CategoryNameSchema,
});
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  postCount: z.number().int().nonnegative(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreatePostInputSchema = z.object({
  title: PostTitleSchema,
  description: PostDescriptionSchema.optional().default(null),
  categoryId: z
    .union([z.string().uuid(), z.null(), z.undefined(), z.literal("")])
    .transform((val) => (val === "" || val === undefined ? null : val))
    .nullable()
    .optional(),
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
    .max(SEARCH_QUERY_MAX)
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      return trimmed === "" ? undefined : trimmed;
    }),
  sort: z.enum(["top", "new", "match"]).optional(),
  category: z.string().uuid().optional(),
  status: z.union([z.literal("all"), z.literal("open"), z.string().uuid()]).optional(),
  cursor: z.string().max(200).optional(),
});
export type BoardQuery = z.infer<typeof BoardQuerySchema>;

export const AdminBoardQuerySchema = BoardQuerySchema.extend({
  view: z.literal("deleted").optional(),
});
export type AdminBoardQuery = z.infer<typeof AdminBoardQuerySchema>;

export const AdminPostRowSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
  title: z.string(),
  status: PostStatusSchema,
  category: PostCategorySchema.nullable(),
  voteCount: z.number().int(),
  commentCount: z.number().int(),
  createdAt: z.string(),
});
export type AdminPostRow = z.infer<typeof AdminPostRowSchema>;

export const AdminPostPageSchema = z.object({
  posts: z.array(AdminPostRowSchema),
  nextCursor: z.string().nullable(),
});
export type AdminPostPage = z.infer<typeof AdminPostPageSchema>;

export const DeletedPostRowSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  deletedAt: z.string(),
  deletedBy: z.string().nullable(),
  deletedByAuthor: z.boolean(),
});
export type DeletedPostRow = z.infer<typeof DeletedPostRowSchema>;

export const DeletedPostPageSchema = z.object({
  posts: z.array(DeletedPostRowSchema),
  nextCursor: z.string().nullable(),
});
export type DeletedPostPage = z.infer<typeof DeletedPostPageSchema>;

export const AdminBoardListResponseSchema = z.union([
  AdminPostPageSchema,
  DeletedPostPageSchema,
]);
export type AdminBoardListResponse = z.infer<typeof AdminBoardListResponseSchema>;

export const DeletedCommentRowSchema = z.object({
  id: z.string().uuid(),
  excerpt: z.string(),
  post: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    deleted: z.boolean(),
  }),
  authorName: z.string().nullable(),
  deletedAt: z.string(),
});
export type DeletedCommentRow = z.infer<typeof DeletedCommentRowSchema>;

export const VoterSchema = z.object({
  name: z.string().nullable(),
  image: z.string().nullable(),
  deleted: z.boolean(),
  votedAt: z.string(),
});
export type Voter = z.infer<typeof VoterSchema>;

export const VoterPageSchema = z.object({
  total: z.number().int().nonnegative(),
  voters: z.array(VoterSchema),
  nextCursor: z.string().nullable(),
});
export type VoterPage = z.infer<typeof VoterPageSchema>;

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
  roadmapItem: PostRoadmapItemRefSchema.nullable().optional(),
});
export type PublicPostDetail = z.infer<typeof PublicPostDetailSchema>;

export const CommentBodySchema = z
  .string({ message: "comment_required" })
  .transform((val) => val.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "comment_required" })
      .max(COMMENT_BODY_MAX, { message: "comment_too_long" })
  );

export const CreateCommentInputSchema = z.object({
  body: CommentBodySchema,
  parentId: z.string().uuid().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;

export const UpdateCommentInputSchema = z.object({
  body: CommentBodySchema,
  version: z.number().int(),
});
export type UpdateCommentInput = z.infer<typeof UpdateCommentInputSchema>;

export const PublicCommentSchema = z.object({
  id: z.string().uuid(),
  author: PublicAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  version: z.number().int(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type PublicComment = z.infer<typeof PublicCommentSchema>;

export const UpdatePostInputSchema = z.object({
  title: PostTitleSchema,
  description: PostDescriptionSchema.optional().default(null),
  categoryId: z
    .union([z.string().uuid(), z.null(), z.undefined(), z.literal("")])
    .transform((val) => (val === "" || val === undefined ? null : val))
    .nullable()
    .optional(),
  version: z.number().int(),
});
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;

export const StatusNoteSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(
    z.string().max(STATUS_NOTE_MAX, { message: "note_too_long" }).nullable()
  );

export const StatusChangeInputSchema = z.object({
  statusId: z.string().uuid(),
  note: StatusNoteSchema.optional(),
  version: z.number().int(),
});
export type StatusChangeInput = z.infer<typeof StatusChangeInputSchema>;

export const ActivityEntrySchema = z.object({
  id: z.string().uuid(),
  actor: PublicAuthorSchema,
  statusName: z.string(),
  statusColor: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const StatusChangeResultSchema = z.object({
  status: PostStatusSchema,
  version: z.number().int(),
  activity: ActivityEntrySchema.nullable(),
});
export type StatusChangeResult = z.infer<typeof StatusChangeResultSchema>;

export const TimelineItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("comment"),
    comment: PublicCommentSchema,
    replies: z.array(PublicCommentSchema),
  }),
  z.object({
    kind: z.literal("stub"),
    id: z.string().uuid(),
    replies: z.array(PublicCommentSchema),
  }),
  z.object({
    kind: z.literal("activity"),
    activity: ActivityEntrySchema,
  }),
]);
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const PublicPostPageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("post"),
    post: PublicPostDetailSchema,
    viewer: PostViewerSchema,
    timeline: z.array(TimelineItemSchema),
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

export const AdminPostDetailSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("post"),
    post: PublicPostDetailSchema,
    deleted: z.boolean(),
    timeline: z.array(TimelineItemSchema),
    viewer: PostViewerSchema,
  }),
  z.object({
    kind: z.literal("redirect"),
    number: z.number().int().positive(),
  }),
]);
export type AdminPostDetail = z.infer<typeof AdminPostDetailSchema>;

export const MergeInputSchema = z.object({
  targetNumber: z.number().int().positive(),
});
export type MergeInput = z.infer<typeof MergeInputSchema>;

export const BulkMergeInputSchema = z.object({
  keepNumber: z.number().int().positive(),
  mergeNumbers: z.array(z.number().int().positive()).min(1).max(50),
});
export type BulkMergeInput = z.infer<typeof BulkMergeInputSchema>;

export const MergeResultSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
  voteCount: z.number().int().nonnegative(),
});
export type MergeResult = z.infer<typeof MergeResultSchema>;


