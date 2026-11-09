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
import { localize } from "../portal/localize.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { PortalFeature } from "../portal/product-features.js";

@Controller("portal/:ws/:product/faq")
@UseGuards(PortalGuard)
@PortalFeature("faq")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalFaqController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicFaqResponseSchema })
  async getPublicFaq(@Req() req: any): Promise<PublicFaqResponse> {
    const { productId } = req.portal ?? {};
    const portal = req.portal ?? {};
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
        sourceLocale: faqQuestions.sourceLocale,
        translations: faqQuestions.translations,
      })
      .from(faqQuestions)
      .where(eq(faqQuestions.productId, productId))
      .orderBy(asc(sql`${faqQuestions.rank} COLLATE "C"`));

    const questionsByCat = new Map<string, PublicFaqQuestion[]>();
    for (const q of questions) {
      const list = questionsByCat.get(q.categoryId) ?? [];
      const { translation: tr, resolvedLocale, isFallback } = localize<{ question?: string; answer?: any }>(
        portal,
        q.translations,
        (t) => Boolean(t.question?.trim() || t.answer),
        (q.sourceLocale as any) ?? undefined,
      );
      list.push({
        id: q.id,
        question: tr?.question?.trim() ? tr.question : q.question,
        answer: (tr?.answer ?? q.answer) as any,
        sourceLocale: (q.sourceLocale as any) ?? undefined,
        resolvedLocale,
        isFallback,
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
