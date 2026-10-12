import { z } from "zod";
import { RichTextDocSchema } from "./rich-text.js";

export const FAQ_CATEGORY_NAME_MIN = 2;
export const FAQ_CATEGORY_NAME_MAX = 50;
export const FAQ_QUESTION_MIN = 5;
export const FAQ_QUESTION_MAX = 200;

export const FaqCategoryInputSchema = z.object({
  name: z
    .string({ message: "category_name_required" })
    .trim()
    .min(FAQ_CATEGORY_NAME_MIN, { message: "category_name_required" })
    .max(FAQ_CATEGORY_NAME_MAX, { message: "category_name_too_long" }),
  rank: z.string().optional(),
});
export type FaqCategoryInput = z.infer<typeof FaqCategoryInputSchema>;

export const MoveFaqCategoryInputSchema = z.object({
  targetRank: z.string().optional(),
  rank: z.string().optional(),
});
export type MoveFaqCategoryInput = z.infer<typeof MoveFaqCategoryInputSchema>;
export const ReorderCategoryInputSchema = MoveFaqCategoryInputSchema;
export type ReorderCategoryInput = MoveFaqCategoryInput;

export const MoveFaqCategoryResponseSchema = z.object({
  success: z.boolean(),
  rank: z.string(),
});
export type MoveFaqCategoryResponse = z.infer<typeof MoveFaqCategoryResponseSchema>;

export const FaqQuestionInputSchema = z.object({
  categoryId: z.string().uuid({ message: "category_required" }),
  question: z
    .string({ message: "title_required" })
    .trim()
    .min(1, { message: "title_required" })
    .min(FAQ_QUESTION_MIN, { message: "title_length" })
    .max(FAQ_QUESTION_MAX, { message: "title_length" }),
  answer: RichTextDocSchema,
  rank: z.string().optional(),
});
export type FaqQuestionInput = z.infer<typeof FaqQuestionInputSchema>;
export const CreateFaqQuestionInputSchema = FaqQuestionInputSchema;
export type CreateFaqQuestionInput = FaqQuestionInput;

export const UpdateFaqQuestionInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  question: z
    .string()
    .trim()
    .min(1, { message: "title_required" })
    .min(FAQ_QUESTION_MIN, { message: "title_length" })
    .max(FAQ_QUESTION_MAX, { message: "title_length" })
    .optional(),
  answer: RichTextDocSchema.optional(),
});
export type UpdateFaqQuestionInput = z.infer<typeof UpdateFaqQuestionInputSchema>;

export const MoveFaqQuestionInputSchema = z.object({
  targetRank: z.string().optional(),
  rank: z.string().optional(),
  targetCategoryId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});
export type MoveFaqQuestionInput = z.infer<typeof MoveFaqQuestionInputSchema>;
export const ReorderQuestionInputSchema = MoveFaqQuestionInputSchema;
export type ReorderQuestionInput = MoveFaqQuestionInput;

export const MoveFaqQuestionResponseSchema = z.object({
  success: z.boolean(),
  rank: z.string(),
  categoryId: z.string().uuid(),
});
export type MoveFaqQuestionResponse = z.infer<typeof MoveFaqQuestionResponseSchema>;

export const AdminFaqQuestionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  question: z.string(),
  answer: RichTextDocSchema,
  rank: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminFaqQuestion = z.infer<typeof AdminFaqQuestionSchema>;

export const AdminFaqCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rank: z.string(),
  questions: z.array(AdminFaqQuestionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminFaqCategory = z.infer<typeof AdminFaqCategorySchema>;

export const AdminFaqResponseSchema = z.object({
  categories: z.array(AdminFaqCategorySchema),
});
export type AdminFaqResponse = z.infer<typeof AdminFaqResponseSchema>;

export const PublicFaqQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  answer: RichTextDocSchema,
});
export type PublicFaqQuestion = z.infer<typeof PublicFaqQuestionSchema>;

export const PublicFaqCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  questions: z.array(PublicFaqQuestionSchema),
});
export type PublicFaqCategory = z.infer<typeof PublicFaqCategorySchema>;

export const PublicFaqResponseSchema = z.object({
  categories: z.array(PublicFaqCategorySchema),
});
export type PublicFaqResponse = z.infer<typeof PublicFaqResponseSchema>;
