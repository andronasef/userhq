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
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

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
  const isEditing = Boolean(question);

  const defaultLocale = productLocales?.defaultLocale ?? DEFAULT_LOCALE;
  const enabledLocales = (productLocales?.enabledLocales && productLocales.enabledLocales.length > 0)
    ? productLocales.enabledLocales
    : [defaultLocale];
  const [activeLocale, setActiveLocale] = React.useState<SupportedLocale>(defaultLocale);
  const [translations, setTranslations] = React.useState<
    Record<string, { question?: string; answer?: RichTextDoc | null }>
  >(question?.translations ?? {});

  const [categoryId, setCategoryId] = React.useState(
    question?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ""
  );
  const [title, setTitle] = React.useState(question?.question ?? "");
  const [answer, setAnswer] = React.useState<RichTextDoc | null>(
    question?.answer ?? { type: "doc", content: [] }
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
    activeLocale === defaultLocale ? title : (translations[activeLocale]?.question ?? "");
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
        const trans = translations[loc];
        status[loc] = Boolean(trans?.question?.trim());
      }
    }
    return status;
  }, [enabledLocales, defaultLocale, title, translations]);

  const handleCurrentTitleChange = (nextTitle: string) => {
    if (activeLocale === defaultLocale) {
      setTitle(nextTitle);
      if (errors.title) {
        setErrors((prev) => ({ ...prev, title: "" }));
      }
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          question: nextTitle,
        },
      }));
    }
  };

  const handleCurrentAnswerChange = (nextAnswer: RichTextDoc | null) => {
    if (activeLocale === defaultLocale) {
      setAnswer(nextAnswer);
      if (errors.answer) {
        setErrors((prev) => ({ ...prev, answer: "" }));
      }
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          answer: nextAnswer,
        },
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!categoryId) {
      newErrors.categoryId = "Choose a category.";
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      newErrors.title = "Enter a title.";
    } else if (trimmedTitle.length < 5 || trimmedTitle.length > 200) {
      newErrors.title = "Title must be between 5 and 200 characters.";
    }

    const hasContent =
      answer?.content &&
      answer.content.length > 0 &&
      answer.content.some((node: any) => {
        if (node.text?.trim()) return true;
        if (Array.isArray(node.content) && node.content.length > 0) return true;
        return false;
      });

    if (!hasContent) {
      newErrors.answer = "Content cannot be empty.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (isEditing && question) {
        const oldCatId = question.categoryId;
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
          }
        );
        toast.success("Question updated");
        onSuccess(updated, oldCatId !== categoryId ? oldCatId : undefined);
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
          }
        );
        toast.success("Question created");
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
            {isEditing ? "Edit question" : "New question"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the question, category, or answer prose."
              : "Add a question and comprehensive answer to this FAQ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <EntryLocaleTabs
            activeLocale={activeLocale}
            onSelectLocale={setActiveLocale}
            defaultLocale={defaultLocale}
            enabledLocales={enabledLocales}
            translationsStatus={translationsStatus}
          />

          <Field id="faq-question-category" label="Category" error={errors.categoryId}>
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
            label={`Question ${activeLocale !== defaultLocale ? `(${activeLocale})` : ""}`}
            error={errors.title}
          >
            <Input
              type="text"
              placeholder={
                activeLocale === defaultLocale
                  ? "e.g. How do I change my billing payment method?"
                  : `Translation for question (${activeLocale})...`
              }
              value={currentTitle}
              onChange={(e) => handleCurrentTitleChange(e.target.value)}
              dir={isRtl(activeLocale) ? "rtl" : "ltr"}
              minLength={activeLocale === defaultLocale ? 5 : undefined}
              maxLength={200}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <label htmlFor="faq-question-answer" className="text-sm font-semibold text-foreground">
              Answer {activeLocale !== defaultLocale && `(${activeLocale})`}
            </label>
            <div dir={isRtl(activeLocale) ? "rtl" : "ltr"}>
              <RichTextEditor
                key={`${question?.id ?? "new"}-${activeLocale}`}
                initialContent={currentAnswer}
                onChange={handleCurrentAnswerChange}
                placeholder={
                  activeLocale === defaultLocale
                    ? "Write the detailed answer here..."
                    : `Write answer in ${activeLocale}...`
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
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                ? "Save question"
                : "Create question"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
