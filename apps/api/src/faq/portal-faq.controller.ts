import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { eq, asc, sql } from "drizzle-orm";
import { DB, type Db, faqCategories, faqQuestions } from "@userhq/db";
import {
  PublicFaqResponseSchema,
  type PublicFaqResponse,
  type PublicFaqQuestion,
} from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";

@Controller("portal/:ws/:product/faq")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalFaqController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicFaqResponseSchema })
  async getPublicFaq(@Req() req: any): Promise<PublicFaqResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const categories = await this.db
      .select({
        id: faqCategories.id,
        name: faqCategories.name,
        rank: faqCategories.rank,
      })
      .from(faqCategories)
      .where(eq(faqCategories.productId, productId))
      .orderBy(asc(sql`${faqCategories.rank} COLLATE "C"`));

    const questions = await this.db
      .select({
        id: faqQuestions.id,
        categoryId: faqQuestions.categoryId,
        question: faqQuestions.question,
        answer: faqQuestions.answer,
        rank: faqQuestions.rank,
      })
      .from(faqQuestions)
      .where(eq(faqQuestions.productId, productId))
      .orderBy(asc(sql`${faqQuestions.rank} COLLATE "C"`));

    const questionsByCat = new Map<string, PublicFaqQuestion[]>();
    for (const q of questions) {
      const list = questionsByCat.get(q.categoryId) ?? [];
      list.push({
        id: q.id,
        question: q.question,
        answer: q.answer as any,
      });
      questionsByCat.set(q.categoryId, list);
    }

    return {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        questions: questionsByCat.get(cat.id) ?? [],
      })),
    };
  }
}
