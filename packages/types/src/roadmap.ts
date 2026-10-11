import { z } from "zod";

export const ROADMAP_TITLE_MIN = 3;
export const ROADMAP_TITLE_MAX = 120;
export const ROADMAP_DESC_MAX = 5000;
export const ROADMAP_NOTES_MAX = 5000;

export const RoadmapInternalTitleSchema = z
  .string({ message: "item_title_required" })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "item_title_required" })
      .min(ROADMAP_TITLE_MIN, { message: "item_title_length" })
      .max(ROADMAP_TITLE_MAX, { message: "item_title_length" })
  );

export const RoadmapPublicTitleSchema = z
  .string({ message: "public_title_required" })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "public_title_required" })
      .min(ROADMAP_TITLE_MIN, { message: "public_title_length" })
      .max(ROADMAP_TITLE_MAX, { message: "public_title_length" })
  );

export const AdminRoadmapAssigneeSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});
export type AdminRoadmapAssignee = z.infer<typeof AdminRoadmapAssigneeSchema>;

export const AdminRoadmapItemSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  internalTitle: z.string(),
  internalDescription: z.string().nullable(),
  internalNotes: z.string().nullable(),
  publicTitle: z.string().nullable(),
  publicDescription: z.string().nullable(),
  isPublic: z.boolean(),
  rank: z.string(),
  assignee: AdminRoadmapAssigneeSchema.nullable(),
  deadlineText: z.string().nullable(),
  deadlineDate: z.string().nullable(),
  linkedPostCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminRoadmapItem = z.infer<typeof AdminRoadmapItemSchema>;

export const AdminRoadmapListResponseSchema = z.object({
  items: z.array(AdminRoadmapItemSchema),
});
export type AdminRoadmapListResponse = z.infer<typeof AdminRoadmapListResponseSchema>;

export const PublicRoadmapItemSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  title: z.string(), // publicTitle
  description: z.string().nullable(), // publicDescription
  postCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type PublicRoadmapItem = z.infer<typeof PublicRoadmapItemSchema>;

export const PublicRoadmapListResponseSchema = z.object({
  items: z.array(PublicRoadmapItemSchema),
});
export type PublicRoadmapListResponse = z.infer<typeof PublicRoadmapListResponseSchema>;

export const CreateRoadmapItemInputSchema = z.object({
  statusId: z.string().uuid(),
  internalTitle: RoadmapInternalTitleSchema,
  internalDescription: z
    .string()
    .max(ROADMAP_DESC_MAX, { message: "description_too_long" })
    .nullable()
    .optional(),
  internalNotes: z
    .string()
    .max(ROADMAP_NOTES_MAX, { message: "notes_too_long" })
    .nullable()
    .optional(),
  publicTitle: RoadmapPublicTitleSchema.nullable().optional(),
  publicDescription: z
    .string()
    .max(ROADMAP_DESC_MAX, { message: "description_too_long" })
    .nullable()
    .optional(),
  isPublic: z.boolean().default(false),
  assigneeId: z.string().nullable().optional(),
  deadlineText: z.string().max(60).nullable().optional(),
  deadlineDate: z.string().nullable().optional(),
  rank: z.string().optional(),
  postIds: z.array(z.string().uuid()).optional(),
});
export type CreateRoadmapItemInput = z.infer<typeof CreateRoadmapItemInputSchema>;

export const UpdateRoadmapItemInputSchema = z.object({
  statusId: z.string().uuid().optional(),
  internalTitle: RoadmapInternalTitleSchema.optional(),
  internalDescription: z
    .string()
    .max(ROADMAP_DESC_MAX, { message: "description_too_long" })
    .nullable()
    .optional(),
  internalNotes: z
    .string()
    .max(ROADMAP_NOTES_MAX, { message: "notes_too_long" })
    .nullable()
    .optional(),
  publicTitle: RoadmapPublicTitleSchema.nullable().optional(),
  publicDescription: z
    .string()
    .max(ROADMAP_DESC_MAX, { message: "description_too_long" })
    .nullable()
    .optional(),
  isPublic: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  deadlineText: z.string().max(60).nullable().optional(),
  deadlineDate: z.string().nullable().optional(),
});
export type UpdateRoadmapItemInput = z.infer<typeof UpdateRoadmapItemInputSchema>;

export const MoveRoadmapItemInputSchema = z.object({
  statusId: z.string().uuid(),
  targetRank: z.string(),
  previousStatusId: z.string().uuid().optional(),
});
export type MoveRoadmapItemInput = z.infer<typeof MoveRoadmapItemInputSchema>;

export const RoadmapPostLinkSearchResultSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  statusId: z.string().uuid(),
  roadmapItemId: z.string().uuid().nullable(),
  voteCount: z.number().int(),
});
export type RoadmapPostLinkSearchResult = z.infer<typeof RoadmapPostLinkSearchResultSchema>;

export const RoadmapPostLinkSearchResponseSchema = z.object({
  posts: z.array(RoadmapPostLinkSearchResultSchema),
});
export type RoadmapPostLinkSearchResponse = z.infer<typeof RoadmapPostLinkSearchResponseSchema>;

export const PostRoadmapItemRefSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});
export type PostRoadmapItemRef = z.infer<typeof PostRoadmapItemRefSchema>;

export const PublicRoadmapPostRefSchema = z.object({
  number: z.number().int().positive(),
  slug: z.string(),
  title: z.string(),
  voteCount: z.number().int(),
});
export type PublicRoadmapPostRef = z.infer<typeof PublicRoadmapPostRefSchema>;

export const PublicRoadmapDetailResponseSchema = z.object({
  item: PublicRoadmapItemSchema,
  posts: z.array(PublicRoadmapPostRefSchema),
});
export type PublicRoadmapDetailResponse = z.infer<typeof PublicRoadmapDetailResponseSchema>;
