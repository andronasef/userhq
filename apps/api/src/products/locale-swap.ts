import { eq } from "drizzle-orm";
import { changelogEntries, faqQuestions, roadmapItems } from "@userhq/db";
import type { SupportedLocale } from "@userhq/types";

export interface LocaleSwapStats {
  changelog: { total: number; promoted: number; fallback: number };
  faq: { total: number; promoted: number; fallback: number };
  roadmap: { total: number; promoted: number; fallback: number };
}

export async function previewLocaleSwap(
  executor: any,
  productId: string,
  oldDefault: SupportedLocale,
  newDefault: SupportedLocale,
): Promise<LocaleSwapStats> {
  const cl = await executor
    .select({ translations: changelogEntries.translations, sourceLocale: changelogEntries.sourceLocale })
    .from(changelogEntries)
    .where(eq(changelogEntries.productId, productId));

  let clPromoted = 0;
  for (const item of cl) {
    const tr = (item.translations ?? {}) as Record<string, any>;
    if (tr[newDefault] && (tr[newDefault].title?.trim() || tr[newDefault].content)) {
      clPromoted++;
    }
  }

  const fq = await executor
    .select({ translations: faqQuestions.translations, sourceLocale: faqQuestions.sourceLocale })
    .from(faqQuestions)
    .where(eq(faqQuestions.productId, productId));

  let faqPromoted = 0;
  for (const item of fq) {
    const tr = (item.translations ?? {}) as Record<string, any>;
    if (tr[newDefault] && (tr[newDefault].question?.trim() || tr[newDefault].answer)) {
      faqPromoted++;
    }
  }

  const rm = await executor
    .select({ translations: roadmapItems.translations, sourceLocale: roadmapItems.sourceLocale })
    .from(roadmapItems)
    .where(eq(roadmapItems.productId, productId));

  let rmPromoted = 0;
  for (const item of rm) {
    const tr = (item.translations ?? {}) as Record<string, any>;
    if (tr[newDefault] && (tr[newDefault].publicTitle?.trim() || tr[newDefault].publicDescription?.trim())) {
      rmPromoted++;
    }
  }

  return {
    changelog: { total: cl.length, promoted: clPromoted, fallback: cl.length - clPromoted },
    faq: { total: fq.length, promoted: faqPromoted, fallback: fq.length - faqPromoted },
    roadmap: { total: rm.length, promoted: rmPromoted, fallback: rm.length - rmPromoted },
  };
}

export async function executeLocaleSwap(
  tx: any,
  productId: string,
  oldDefault: SupportedLocale,
  newDefault: SupportedLocale,
): Promise<LocaleSwapStats> {
  // 1. Changelog Entries
  const clEntries = await tx
    .select({
      id: changelogEntries.id,
      title: changelogEntries.title,
      summary: changelogEntries.summary,
      content: changelogEntries.content,
      translations: changelogEntries.translations,
      sourceLocale: changelogEntries.sourceLocale,
    })
    .from(changelogEntries)
    .where(eq(changelogEntries.productId, productId));

  let clPromoted = 0;
  for (const entry of clEntries) {
    const trans = (entry.translations ?? {}) as Record<string, any>;
    const target = trans[newDefault];
    const hasTarget = target && (target.title?.trim() || target.content);

    if (hasTarget) {
      clPromoted++;
      const updatedTrans = { ...trans };
      delete updatedTrans[newDefault];
      const sourceKey = entry.sourceLocale || oldDefault;
      updatedTrans[sourceKey] = {
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
      };

      await tx
        .update(changelogEntries)
        .set({
          title: target.title?.trim() ? target.title : entry.title,
          summary: target.summary !== undefined ? target.summary : entry.summary,
          content: target.content ?? entry.content,
          translations: updatedTrans,
          sourceLocale: newDefault,
        })
        .where(eq(changelogEntries.id, entry.id));
    } else if (!entry.sourceLocale) {
      await tx
        .update(changelogEntries)
        .set({ sourceLocale: oldDefault })
        .where(eq(changelogEntries.id, entry.id));
    }
  }

  // 2. FAQ Questions
  const faqRows = await tx
    .select({
      id: faqQuestions.id,
      question: faqQuestions.question,
      answer: faqQuestions.answer,
      translations: faqQuestions.translations,
      sourceLocale: faqQuestions.sourceLocale,
    })
    .from(faqQuestions)
    .where(eq(faqQuestions.productId, productId));

  let faqPromoted = 0;
  for (const q of faqRows) {
    const trans = (q.translations ?? {}) as Record<string, any>;
    const target = trans[newDefault];
    const hasTarget = target && (target.question?.trim() || target.answer);

    if (hasTarget) {
      faqPromoted++;
      const updatedTrans = { ...trans };
      delete updatedTrans[newDefault];
      const sourceKey = q.sourceLocale || oldDefault;
      updatedTrans[sourceKey] = {
        question: q.question,
        answer: q.answer,
      };

      await tx
        .update(faqQuestions)
        .set({
          question: target.question?.trim() ? target.question : q.question,
          answer: target.answer ?? q.answer,
          translations: updatedTrans,
          sourceLocale: newDefault,
        })
        .where(eq(faqQuestions.id, q.id));
    } else if (!q.sourceLocale) {
      await tx
        .update(faqQuestions)
        .set({ sourceLocale: oldDefault })
        .where(eq(faqQuestions.id, q.id));
    }
  }

  // 3. Roadmap Items
  const rmRows = await tx
    .select({
      id: roadmapItems.id,
      publicTitle: roadmapItems.publicTitle,
      publicDescription: roadmapItems.publicDescription,
      translations: roadmapItems.translations,
      sourceLocale: roadmapItems.sourceLocale,
    })
    .from(roadmapItems)
    .where(eq(roadmapItems.productId, productId));

  let rmPromoted = 0;
  for (const item of rmRows) {
    const trans = (item.translations ?? {}) as Record<string, any>;
    const target = trans[newDefault];
    const hasTarget = target && (target.publicTitle?.trim() || target.publicDescription?.trim());

    if (hasTarget) {
      rmPromoted++;
      const updatedTrans = { ...trans };
      delete updatedTrans[newDefault];
      const sourceKey = item.sourceLocale || oldDefault;
      updatedTrans[sourceKey] = {
        publicTitle: item.publicTitle,
        publicDescription: item.publicDescription,
      };

      await tx
        .update(roadmapItems)
        .set({
          publicTitle: target.publicTitle?.trim() ? target.publicTitle : item.publicTitle,
          publicDescription: target.publicDescription !== undefined ? target.publicDescription : item.publicDescription,
          translations: updatedTrans,
          sourceLocale: newDefault,
        })
        .where(eq(roadmapItems.id, item.id));
    } else if (!item.sourceLocale) {
      await tx
        .update(roadmapItems)
        .set({ sourceLocale: oldDefault })
        .where(eq(roadmapItems.id, item.id));
    }
  }

  return {
    changelog: { total: clEntries.length, promoted: clPromoted, fallback: clEntries.length - clPromoted },
    faq: { total: faqRows.length, promoted: faqPromoted, fallback: faqRows.length - faqPromoted },
    roadmap: { total: rmRows.length, promoted: rmPromoted, fallback: rmRows.length - rmPromoted },
  };
}
