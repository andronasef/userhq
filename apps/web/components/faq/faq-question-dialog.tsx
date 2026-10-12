"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import type { AdminFaqQuestion, AdminFaqCategory, RichTextDoc } from "@userhq/types";
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
  onSuccess,
}: FaqQuestionDialogProps): React.JSX.Element {
  const isEditing = Boolean(question);
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
      if (question) {
        setCategoryId(question.categoryId);
        setTitle(question.question);
        setAnswer(question.answer);
      } else {
        setCategoryId(defaultCategoryId ?? categories[0]?.id ?? "");
        setTitle("");
        setAnswer({ type: "doc", content: [] });
      }
      setErrors({});
    }
  }, [open, question, defaultCategoryId, categories]);

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

          <Field id="faq-question-title" label="Question" error={errors.title}>
            <Input
              type="text"
              placeholder="e.g. How do I change my billing payment method?"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors((prev) => ({ ...prev, title: "" }));
                }
              }}
              minLength={5}
              maxLength={200}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <label htmlFor="faq-question-answer" className="text-sm font-semibold text-foreground">
              Answer
            </label>
            <RichTextEditor
              key={question ? question.id : "new-question"}
              initialContent={answer}
              onChange={(doc) => {
                setAnswer(doc);
                if (errors.answer) {
                  setErrors((prev) => ({ ...prev, answer: "" }));
                }
              }}
              placeholder="Write the detailed answer here..."
            />
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
