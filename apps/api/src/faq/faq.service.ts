import { Injectable, Inject } from "@nestjs/common";
import { and, eq, desc, asc, sql } from "drizzle-orm";
import { DB, type Db, faqCategories, faqQuestions } from "@userhq/db";
import {
  generateKeyBetween,
  isValidRank,
  type FaqCategoryInput,
  type MoveFaqCategoryInput,
  type MoveFaqCategoryResponse,
  type FaqQuestionInput,
  type UpdateFaqQuestionInput,
  type MoveFaqQuestionInput,
  type MoveFaqQuestionResponse,
  type AdminFaqCategory,
  type AdminFaqQuestion,
  type AdminFaqResponse,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isUniqueViolation } from "../common/db-errors.js";

function compareRanks(a: { rank: string }, b: { rank: string }): number {
  if (a.rank < b.rank) return -1;
  if (a.rank > b.rank) return 1;
  return 0;
}

@Injectable()
export class FaqService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listAdminFaq(productId: string): Promise<AdminFaqResponse> {
    const categories = await this.db
      .select({
        id: faqCategories.id,
        name: faqCategories.name,
        rank: faqCategories.rank,
        createdAt: faqCategories.createdAt,
        updatedAt: faqCategories.updatedAt,
      })
      .from(faqCategories)
      .where(eq(faqCategories.productId, productId))
      .orderBy(asc(sql`${faqCategories.rank} COLLATE "C"`));

    categories.sort(compareRanks);

    const questions = await this.db
      .select({
        id: faqQuestions.id,
        categoryId: faqQuestions.categoryId,
        question: faqQuestions.question,
        answer: faqQuestions.answer,
        rank: faqQuestions.rank,
        createdAt: faqQuestions.createdAt,
        updatedAt: faqQuestions.updatedAt,
      })
      .from(faqQuestions)
      .where(eq(faqQuestions.productId, productId))
      .orderBy(asc(sql`${faqQuestions.rank} COLLATE "C"`));

    questions.sort(compareRanks);

    const questionsByCat = new Map<string, AdminFaqQuestion[]>();
    for (const q of questions) {
      const list = questionsByCat.get(q.categoryId) ?? [];
      list.push({
        id: q.id,
        categoryId: q.categoryId,
        question: q.question,
        answer: q.answer as any,
        rank: q.rank,
        createdAt: new Date(q.createdAt).toISOString(),
        updatedAt: new Date(q.updatedAt).toISOString(),
      });
      questionsByCat.set(q.categoryId, list);
    }

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        rank: c.rank,
        questions: questionsByCat.get(c.id) ?? [],
        createdAt: new Date(c.createdAt).toISOString(),
        updatedAt: new Date(c.updatedAt).toISOString(),
      })),
    };
  }

  async createCategory(
    productId: string,
    input: FaqCategoryInput
  ): Promise<AdminFaqCategory> {
    let rank = input.rank;
    if (!rank || !isValidRank(rank)) {
      const [highest] = await this.db
        .select({ rank: faqCategories.rank })
        .from(faqCategories)
        .where(eq(faqCategories.productId, productId))
        .orderBy(desc(sql`${faqCategories.rank} COLLATE "C"`))
        .limit(1);

      rank = generateKeyBetween(highest?.rank ?? null, null);
    }

    try {
      const [created] = await this.db
        .insert(faqCategories)
        .values({
          productId,
          name: input.name.trim(),
          rank,
        })
        .returning();

      return {
        id: created.id,
        name: created.name,
        rank: created.rank,
        questions: [],
        createdAt: new Date(created.createdAt).toISOString(),
        updatedAt: new Date(created.updatedAt).toISOString(),
      };
    } catch (err) {
      if (isUniqueViolation(err, "faq_categories_product_name_ci")) {
        throw new ApiException(
          "category_name_taken",
          409,
          "A category with that name already exists."
        );
      }
      throw err;
    }
  }

  async updateCategory(
    productId: string,
    categoryId: string,
    input: FaqCategoryInput
  ): Promise<AdminFaqCategory> {
    const [existing] = await this.db
      .select({ id: faqCategories.id })
      .from(faqCategories)
      .where(
        and(
          eq(faqCategories.id, categoryId),
          eq(faqCategories.productId, productId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ApiException("not_found", 404, "Category not found.");
    }

    const updates: Record<string, any> = {
      name: input.name.trim(),
      updatedAt: new Date(),
    };
    if (input.rank && isValidRank(input.rank)) {
      updates.rank = input.rank;
    }

    try {
      const [updated] = await this.db
        .update(faqCategories)
        .set(updates)
        .where(eq(faqCategories.id, categoryId))
        .returning();

      const questions = await this.db
        .select({
          id: faqQuestions.id,
          categoryId: faqQuestions.categoryId,
          question: faqQuestions.question,
          answer: faqQuestions.answer,
          rank: faqQuestions.rank,
          createdAt: faqQuestions.createdAt,
          updatedAt: faqQuestions.updatedAt,
        })
        .from(faqQuestions)
        .where(
          and(
            eq(faqQuestions.productId, productId),
            eq(faqQuestions.categoryId, categoryId)
          )
        )
        .orderBy(asc(sql`${faqQuestions.rank} COLLATE "C"`));

      questions.sort(compareRanks);

      return {
        id: updated.id,
        name: updated.name,
        rank: updated.rank,
        questions: questions.map((q) => ({
          id: q.id,
          categoryId: q.categoryId,
          question: q.question,
          answer: q.answer as any,
          rank: q.rank,
          createdAt: new Date(q.createdAt).toISOString(),
          updatedAt: new Date(q.updatedAt).toISOString(),
        })),
        createdAt: new Date(updated.createdAt).toISOString(),
        updatedAt: new Date(updated.updatedAt).toISOString(),
      };
    } catch (err) {
      if (isUniqueViolation(err, "faq_categories_product_name_ci")) {
        throw new ApiException(
          "category_name_taken",
          409,
          "A category with that name already exists."
        );
      }
      throw err;
    }
  }

  async deleteCategory(productId: string, categoryId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(faqCategories)
      .where(
        and(
          eq(faqCategories.id, categoryId),
          eq(faqCategories.productId, productId)
        )
      )
      .returning({ id: faqCategories.id });

    if (!deleted) {
      throw new ApiException("not_found", 404, "Category not found.");
    }
  }

  async reorderCategory(
    productId: string,
    categoryId: string,
    input: MoveFaqCategoryInput
  ): Promise<MoveFaqCategoryResponse> {
    const targetRank = input.targetRank ?? input.rank;
    if (!targetRank || !isValidRank(targetRank)) {
      throw new ApiException("reorder_failed", 400, "Invalid rank format.");
    }

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: faqCategories.id })
        .from(faqCategories)
        .where(
          and(
            eq(faqCategories.id, categoryId),
            eq(faqCategories.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Category not found.");
      }

      await tx
        .update(faqCategories)
        .set({
          rank: targetRank,
          updatedAt: new Date(),
        })
        .where(eq(faqCategories.id, categoryId));

      return { success: true, rank: targetRank };
    });
  }

  async createQuestion(
    productId: string,
    input: FaqQuestionInput
  ): Promise<AdminFaqQuestion> {
    const [cat] = await this.db
      .select({ id: faqCategories.id })
      .from(faqCategories)
      .where(
        and(
          eq(faqCategories.id, input.categoryId),
          eq(faqCategories.productId, productId)
        )
      )
      .limit(1);

    if (!cat) {
      throw new ApiException("category_not_found", 404, "Category not found.");
    }

    let rank = input.rank;
    if (!rank || !isValidRank(rank)) {
      const [highest] = await this.db
        .select({ rank: faqQuestions.rank })
        .from(faqQuestions)
        .where(
          and(
            eq(faqQuestions.productId, productId),
            eq(faqQuestions.categoryId, input.categoryId)
          )
        )
        .orderBy(desc(sql`${faqQuestions.rank} COLLATE "C"`))
        .limit(1);

      rank = generateKeyBetween(highest?.rank ?? null, null);
    }

    const [created] = await this.db
      .insert(faqQuestions)
      .values({
        productId,
        categoryId: input.categoryId,
        question: input.question.trim(),
        answer: input.answer,
        rank,
      })
      .returning();

    return {
      id: created.id,
      categoryId: created.categoryId,
      question: created.question,
      answer: created.answer as any,
      rank: created.rank,
      createdAt: new Date(created.createdAt).toISOString(),
      updatedAt: new Date(created.updatedAt).toISOString(),
    };
  }

  async updateQuestion(
    productId: string,
    questionId: string,
    input: UpdateFaqQuestionInput
  ): Promise<AdminFaqQuestion> {
    const [existing] = await this.db
      .select({ id: faqQuestions.id, categoryId: faqQuestions.categoryId })
      .from(faqQuestions)
      .where(
        and(
          eq(faqQuestions.id, questionId),
          eq(faqQuestions.productId, productId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ApiException("not_found", 404, "Question not found.");
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.question !== undefined) {
      updates.question = input.question.trim();
    }
    if (input.answer !== undefined) {
      updates.answer = input.answer;
    }
    if (input.categoryId !== undefined) {
      const [targetCat] = await this.db
        .select({ id: faqCategories.id })
        .from(faqCategories)
        .where(
          and(
            eq(faqCategories.id, input.categoryId),
            eq(faqCategories.productId, productId)
          )
        )
        .limit(1);

      if (!targetCat) {
        throw new ApiException("category_not_found", 404, "Target category not found.");
      }
      updates.categoryId = input.categoryId;
    }

    const [updated] = await this.db
      .update(faqQuestions)
      .set(updates)
      .where(eq(faqQuestions.id, questionId))
      .returning();

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      question: updated.question,
      answer: updated.answer as any,
      rank: updated.rank,
      createdAt: new Date(updated.createdAt).toISOString(),
      updatedAt: new Date(updated.updatedAt).toISOString(),
    };
  }

  async deleteQuestion(productId: string, questionId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(faqQuestions)
      .where(
        and(
          eq(faqQuestions.id, questionId),
          eq(faqQuestions.productId, productId)
        )
      )
      .returning({ id: faqQuestions.id });

    if (!deleted) {
      throw new ApiException("not_found", 404, "Question not found.");
    }
  }

  async reorderQuestion(
    productId: string,
    questionId: string,
    input: MoveFaqQuestionInput
  ): Promise<MoveFaqQuestionResponse> {
    const targetRank = input.targetRank ?? input.rank;
    if (!targetRank || !isValidRank(targetRank)) {
      throw new ApiException("reorder_failed", 400, "Invalid rank format.");
    }

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: faqQuestions.id, categoryId: faqQuestions.categoryId })
        .from(faqQuestions)
        .where(
          and(
            eq(faqQuestions.id, questionId),
            eq(faqQuestions.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Question not found.");
      }

      const targetCategoryId =
        input.targetCategoryId ?? input.categoryId ?? existing.categoryId;

      if (targetCategoryId !== existing.categoryId) {
        const [targetCat] = await tx
          .select({ id: faqCategories.id })
          .from(faqCategories)
          .where(
            and(
              eq(faqCategories.id, targetCategoryId),
              eq(faqCategories.productId, productId)
            )
          )
          .limit(1);

        if (!targetCat) {
          throw new ApiException("category_not_found", 404, "Target category not found.");
        }
      }

      await tx
        .update(faqQuestions)
        .set({
          categoryId: targetCategoryId,
          rank: targetRank,
          updatedAt: new Date(),
        })
        .where(eq(faqQuestions.id, questionId));

      return {
        success: true,
        rank: targetRank,
        categoryId: targetCategoryId,
      };
    });
  }
}
