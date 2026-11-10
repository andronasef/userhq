"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import type {
  AdminFaqQuestion,
  AdminFaqCategory,
  RichTextDoc,
  ProductLocalesConfig,
  SupportedLocale,
} from "@userhq/types";
import { DEFAULT_LOCALE, isRtl } from "@userhq/types";
import { EntryLocaleTabs } from "../entry-locale-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../ui/field";
import { NativeSelect } from "../ui/native-select";
import { RichTextEditor } from "../rich-text/rich-text-editor";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";
import { hasRichTextContent } from "../../lib/rich-text";

export interface FaqQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: AdminFaqQuestion | null;
  defaultCategoryId?: string;
  categories: AdminFaqCategory[];
  ws: string;
  product: string;
  productLocales?: ProductLocalesConfig | null;
  onSuccess: (question: AdminFaqQuestion, oldCategoryId?: string) => void;
}

export function FaqQuestionDialog({
  open,
  onOpenChange,
  question,
  defaultCategoryId,
  categories,
  ws,
  product,
  productLocales,
  onSuccess,
}: FaqQuestionDialogProps): React.JSX.Element {
  const { t } = useI18n();
  const isEditing = Boolean(question);

  const defaultLocale = productLocales?.defaultLocale ?? DEFAULT_LOCALE;
  const enabledLocales =
    productLocales?.enabledLocales && productLocales.enabledLocales.length > 0
      ? productLocales.enabledLocales
      : [defaultLocale];
  const [activeLocale, setActiveLocale] =
    React.useState<SupportedLocale>(defaultLocale);
  const [translations, setTranslations] = React.useState<
    Record<string, { question?: string; answer?: RichTextDoc | null }>
  >(question?.translations ?? {});

  const [categoryId, setCategoryId] = React.useState(
    question?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [title, setTitle] = React.useState(question?.question ?? "");
  const [answer, setAnswer] = React.useState<RichTextDoc | null>(
    question?.answer ?? { type: "doc", content: [] },
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setActiveLocale(defaultLocale);
      if (question) {
        setCategoryId(question.categoryId);
        setTitle(question.question);
        setAnswer(question.answer);
        setTranslations(question.translations ?? {});
      } else {
        setCategoryId(defaultCategoryId ?? categories[0]?.id ?? "");
        setTitle("");
        setAnswer({ type: "doc", content: [] });
        setTranslations({});
      }
      setErrors({});
    }
  }, [open, question, defaultCategoryId, categories, defaultLocale]);

  const currentTitle =
    activeLocale === defaultLocale
      ? title
      : (translations[activeLocale]?.question ?? "");
  const currentAnswer =
    activeLocale === defaultLocale
      ? answer
      : (translations[activeLocale]?.answer ?? { type: "doc", content: [] });

  const translationsStatus = React.useMemo(() => {
    const status: Partial<Record<SupportedLocale, boolean>> = {};
    for (const loc of enabledLocales) {
      if (loc === defaultLocale) {
        status[loc] = Boolean(title.trim());
      } else {
        status[loc] = Boolean(translations[loc]?.question?.trim());
      }
    }
    return status;
  }, [enabledLocales, defaultLocale, title, translations]);

  const handleCurrentTitleChange = (val: string) => {
    if (activeLocale === defaultLocale) {
      setTitle(val);
      if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          question: val,
        },
      }));
    }
  };

  const handleCurrentAnswerChange = (val: RichTextDoc | null) => {
    if (activeLocale === defaultLocale) {
      setAnswer(val);
      if (errors.answer) setErrors((prev) => ({ ...prev, answer: "" }));
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          answer: val,
        },
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const trimmedTitle = title.trim();

    if (!categoryId) {
      newErrors.categoryId = t("ui.categoryChoose");
    }
    if (trimmedTitle.length < 5 || trimmedTitle.length > 200) {
      newErrors.title = t("faq.questionLengthError");
    }

    if (!hasRichTextContent(answer)) {
      newErrors.answer = t("faq.answerRequired");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (isEditing && question) {
        const oldCatId =
          question.categoryId !== categoryId ? question.categoryId : undefined;
        const updated = await apiFetch<AdminFaqQuestion>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/questions/${encodeURIComponent(question.id)}`,
          {
            method: "PATCH",
            body: {
              categoryId,
              question: trimmedTitle,
              answer: answer ?? { type: "doc", content: [] },
              translations,
            },
          },
        );
        toast.success(t("faq.questionUpdated"));
        onSuccess(updated, oldCatId);
      } else {
        const created = await apiFetch<AdminFaqQuestion>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/questions`,
          {
            method: "POST",
            body: {
              categoryId,
              question: trimmedTitle,
              answer: answer ?? { type: "doc", content: [] },
              translations,
            },
          },
        );
        toast.success(t("faq.questionCreated"));
        onSuccess(created);
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = errorCopy(err);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("faq.editQuestionTitle") : t("faq.newQuestionTitle")}
          </DialogTitle>
          <DialogDescription>{t("faq.questionDialogDesc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <EntryLocaleTabs
            activeLocale={activeLocale}
            onSelectLocale={setActiveLocale}
            defaultLocale={defaultLocale}
            enabledLocales={enabledLocales}
            translationsStatus={translationsStatus}
          />

          <Field
            id="faq-question-category"
            label={t("faq.categoryLabel")}
            error={errors.categoryId}
          >
            <NativeSelect
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errors.categoryId) {
                  setErrors((prev) => ({ ...prev, categoryId: "" }));
                }
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            id="faq-question-title"
            label={`${t("faq.questionLabel")}${activeLocale !== defaultLocale ? ` (${activeLocale})` : ""}`}
            error={errors.title}
          >
            <Input
              type="text"
              placeholder={t("faq.questionPlaceholder")}
              value={currentTitle}
              onChange={(e) => handleCurrentTitleChange(e.target.value)}
              dir={isRtl(activeLocale) ? "rtl" : "ltr"}
              minLength={activeLocale === defaultLocale ? 5 : undefined}
              maxLength={200}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="faq-question-answer"
              className="text-sm font-semibold text-foreground"
            >
              {t("faq.answerLabel")}{" "}
              {activeLocale !== defaultLocale && `(${activeLocale})`}
            </label>
            <div dir={isRtl(activeLocale) ? "rtl" : "ltr"}>
              <RichTextEditor
                key={`${question?.id ?? "new"}-${activeLocale}`}
                initialContent={currentAnswer}
                onChange={handleCurrentAnswerChange}
                placeholder={
                  activeLocale === defaultLocale
                    ? t("faq.detailedAnswerPlaceholder")
                    : t("faq.writeAnswerInLocale", { locale: activeLocale })
                }
              />
            </div>
            {errors.answer && (
              <p className="flex items-center gap-1.5 text-sm font-normal text-destructive">
                <CircleAlert className="size-4 shrink-0" />
                <span>{errors.answer}</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting
                ? t("common.saving")
                : isEditing
                  ? t("common.save")
                  : t("faq.newQuestion")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
