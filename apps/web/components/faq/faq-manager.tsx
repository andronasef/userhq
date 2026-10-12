"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { Plus, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  generateKeyBetween,
  type AdminFaqCategory,
  type AdminFaqQuestion,
} from "@userhq/types";
import { Button } from "../ui/button";
import { EmptyState } from "../empty-state";
import { FaqCategoryItem } from "./faq-category-item";
import { FaqCategoryDialog } from "./faq-category-dialog";
import { FaqQuestionDialog } from "./faq-question-dialog";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface FaqManagerProps {
  ws: string;
  product: string;
  initialCategories: AdminFaqCategory[];
}

export function FaqManager({
  ws,
  product,
  initialCategories,
}: FaqManagerProps): React.JSX.Element {
  const [categories, setCategories] =
    React.useState<AdminFaqCategory[]>(initialCategories);

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] =
    React.useState<AdminFaqCategory | null>(null);

  const [questionDialogOpen, setQuestionDialogOpen] = React.useState(false);
  const [editingQuestion, setEditingQuestion] =
    React.useState<AdminFaqQuestion | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = React.useState<
    string | undefined
  >(undefined);

  // Sort categories and questions by rank ascending
  const sortedCategories = React.useMemo(() => {
    return [...categories]
      .sort((a, b) => a.rank.localeCompare(b.rank))
      .map((cat) => ({
        ...cat,
        questions: [...cat.questions].sort((a, b) =>
          a.rank.localeCompare(b.rank)
        ),
      }));
  }, [categories]);

  const handleDragEnd = async (event: any) => {
    if (event.canceled) return;
    const { source, target } = event.operation;
    if (!source || !target) return;

    const sourceId = String(source.id);

    // Case 1: Category Reordering
    const isCategoryDrag = categories.some((c) => c.id === sourceId);
    if (isCategoryDrag) {
      const draggedCat = categories.find((c) => c.id === sourceId);
      if (!draggedCat) return;

      const otherCats = sortedCategories.filter((c) => c.id !== sourceId);
      const targetIndex =
        typeof target.index === "number"
          ? Math.min(Math.max(0, target.index), otherCats.length)
          : otherCats.length;

      let newRank: string;
      if (otherCats.length === 0) {
        newRank = generateKeyBetween(null, null);
      } else if (targetIndex <= 0) {
        newRank = generateKeyBetween(null, otherCats[0].rank);
      } else if (targetIndex >= otherCats.length) {
        newRank = generateKeyBetween(
          otherCats[otherCats.length - 1].rank,
          null
        );
      } else {
        const prevRank = otherCats[targetIndex - 1].rank;
        const nextRank = otherCats[targetIndex].rank;
        newRank = generateKeyBetween(prevRank, nextRank);
      }

      if (draggedCat.rank === newRank) return;

      const previousCategories = [...categories];
      setCategories((prev) =>
        prev.map((c) => (c.id === sourceId ? { ...c, rank: newRank } : c))
      );

      try {
        await apiFetch(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/categories/${encodeURIComponent(sourceId)}/reorder`,
          {
            method: "PATCH",
            body: { targetRank: newRank },
          }
        );
      } catch (err: any) {
        setCategories(previousCategories);
        toast.error(
          errorCopy(err, undefined) ||
            "Couldn't reorder FAQ category. Check your connection and try again."
        );
      }
      return;
    }

    // Case 2: Question Reordering / Moving
    let sourceQuestion: AdminFaqQuestion | undefined;
    let sourceCatId: string | undefined;

    for (const cat of categories) {
      const q = cat.questions.find((item) => item.id === sourceId);
      if (q) {
        sourceQuestion = q;
        sourceCatId = cat.id;
        break;
      }
    }

    if (!sourceQuestion || !sourceCatId) return;

    // Determine target category
    let targetCatId: string;
    const targetCat = categories.find((c) => c.id === target.id);
    if (targetCat) {
      targetCatId = targetCat.id;
    } else if (target.group && target.group !== "categories") {
      targetCatId = target.group;
    } else {
      targetCatId = sourceCatId;
    }

    // Current questions in the target category excluding dragged question
    const destCat = categories.find((c) => c.id === targetCatId);
    if (!destCat) return;

    const destQuestions = destCat.questions
      .filter((q) => q.id !== sourceId)
      .sort((a, b) => a.rank.localeCompare(b.rank));

    let targetIndex: number;
    if (targetCat) {
      targetIndex = destQuestions.length;
    } else if (typeof target.index === "number") {
      targetIndex = Math.min(
        Math.max(0, target.index),
        destQuestions.length
      );
    } else {
      targetIndex = destQuestions.length;
    }

    let newRank: string;
    if (destQuestions.length === 0) {
      newRank = generateKeyBetween(null, null);
    } else if (targetIndex <= 0) {
      newRank = generateKeyBetween(null, destQuestions[0].rank);
    } else if (targetIndex >= destQuestions.length) {
      newRank = generateKeyBetween(
        destQuestions[destQuestions.length - 1].rank,
        null
      );
    } else {
      const prevRank = destQuestions[targetIndex - 1].rank;
      const nextRank = destQuestions[targetIndex].rank;
      newRank = generateKeyBetween(prevRank, nextRank);
    }

    if (
      sourceCatId === targetCatId &&
      sourceQuestion.rank === newRank
    ) {
      return;
    }

    // Optimistically update
    const previousCategories = [...categories];
    const updatedQuestion: AdminFaqQuestion = {
      ...sourceQuestion,
      categoryId: targetCatId,
      rank: newRank,
    };

    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === sourceCatId && sourceCatId === targetCatId) {
          // Reordering within the same category
          const nextQuestions = cat.questions
            .map((q) => (q.id === sourceId ? updatedQuestion : q))
            .sort((a, b) => a.rank.localeCompare(b.rank));
          return { ...cat, questions: nextQuestions };
        } else if (cat.id === sourceCatId) {
          // Removed from source
          return {
            ...cat,
            questions: cat.questions.filter((q) => q.id !== sourceId),
          };
        } else if (cat.id === targetCatId) {
          // Added to target
          const nextQuestions = [...cat.questions, updatedQuestion].sort((a, b) =>
            a.rank.localeCompare(b.rank)
          );
          return { ...cat, questions: nextQuestions };
        }
        return cat;
      })
    );

    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/questions/${encodeURIComponent(sourceId)}/reorder`,
        {
          method: "PATCH",
          body: {
            targetRank: newRank,
            targetCategoryId: targetCatId,
          },
        }
      );
    } catch (err: any) {
      setCategories(previousCategories);
      toast.error(
        errorCopy(err, undefined) ||
          "Couldn't reorder FAQ question. Check your connection and try again."
      );
    }
  };

  // Dialog handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleOpenRenameCategory = (cat: AdminFaqCategory) => {
    setEditingCategory(cat);
    setCategoryDialogOpen(true);
  };

  const handleOpenAddQuestion = (catId?: string) => {
    setEditingQuestion(null);
    setDefaultCategoryId(catId ?? sortedCategories[0]?.id);
    setQuestionDialogOpen(true);
  };

  const handleOpenEditQuestion = (q: AdminFaqQuestion) => {
    setEditingQuestion(q);
    setQuestionDialogOpen(true);
  };

  const handleCategorySuccess = (saved: AdminFaqCategory) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      if (exists) {
        return prev.map((c) => (c.id === saved.id ? { ...c, name: saved.name } : c));
      }
      return [...prev, saved];
    });
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleQuestionSuccess = (
    saved: AdminFaqQuestion,
    oldCatId?: string
  ) => {
    setCategories((prev) => {
      return prev.map((cat) => {
        if (oldCatId && cat.id === oldCatId) {
          return {
            ...cat,
            questions: cat.questions.filter((q) => q.id !== saved.id),
          };
        }
        if (cat.id === saved.categoryId) {
          const exists = cat.questions.some((q) => q.id === saved.id);
          const nextQuestions = exists
            ? cat.questions.map((q) => (q.id === saved.id ? saved : q))
            : [...cat.questions, saved];
          return {
            ...cat,
            questions: nextQuestions.sort((a, b) =>
              a.rank.localeCompare(b.rank)
            ),
          };
        }
        return cat;
      });
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        questions: cat.questions.filter((q) => q.id !== questionId),
      }))
    );
  };

  if (categories.length === 0) {
    return (
      <>
        <EmptyState
          icon={
            <HelpCircle
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          }
          title="No FAQ categories yet"
          body="Organize self-serve help articles and common questions for your customers."
          action={
            <Button onClick={handleOpenAddCategory}>
              <Plus className="size-4 mr-1.5" />
              New category
            </Button>
          }
        />

        <FaqCategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          category={editingCategory}
          ws={ws}
          product={product}
          onSuccess={handleCategorySuccess}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Drag categories or questions to reorder them on the public portal.
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenAddCategory}
            >
              <Plus className="size-4 mr-1.5" />
              New category
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => handleOpenAddQuestion()}
            >
              <Plus className="size-4 mr-1.5" />
              New question
            </Button>
          </div>
        </div>

        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-4">
            {sortedCategories.map((cat, idx) => (
              <FaqCategoryItem
                key={cat.id}
                category={cat}
                index={idx}
                ws={ws}
                product={product}
                onRename={handleOpenRenameCategory}
                onDeleteCategory={handleDeleteCategory}
                onAddQuestion={handleOpenAddQuestion}
                onEditQuestion={handleOpenEditQuestion}
                onDeleteQuestion={handleDeleteQuestion}
              />
            ))}
          </div>
        </DragDropProvider>
      </div>

      <FaqCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        ws={ws}
        product={product}
        onSuccess={handleCategorySuccess}
      />

      <FaqQuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        question={editingQuestion}
        defaultCategoryId={defaultCategoryId}
        categories={sortedCategories}
        ws={ws}
        product={product}
        onSuccess={handleQuestionSuccess}
      />
    </>
  );
}
