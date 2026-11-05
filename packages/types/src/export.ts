import { z } from "zod";
import { STATUS_TYPES } from "./palette.js";

export const FeedbackExportQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});
export type FeedbackExportQuery = z.infer<typeof FeedbackExportQuerySchema>;

export const FeedbackExportCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  author: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
  }),
  isAdmin: z.boolean(),
  createdByApiKeyId: z.string().uuid().nullable(),
  createdAt: z.string(),
});
export type FeedbackExportComment = z.infer<typeof FeedbackExportCommentSchema>;

export const FeedbackExportItemSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  category: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable(),
  status: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(STATUS_TYPES),
    color: z.string(),
  }),
  author: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
  }),
  voteCount: z.number().int(),
  commentCount: z.number().int(),
  createdByApiKeyId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  comments: z.array(FeedbackExportCommentSchema),
});
export type FeedbackExportItem = z.infer<typeof FeedbackExportItemSchema>;

export const FeedbackExportResponseSchema = z.object({
  items: z.array(FeedbackExportItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  totalCount: z.number().int(),
});
export type FeedbackExportResponse = z.infer<typeof FeedbackExportResponseSchema>;
