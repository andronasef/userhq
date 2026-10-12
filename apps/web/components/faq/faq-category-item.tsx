"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useDroppable } from "@dnd-kit/react";
import { GripVertical, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminFaqCategory, AdminFaqQuestion } from "@userhq/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FaqQuestionItem } from "./faq-question-item";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";
import { cn } from "../../lib/utils";

export interface FaqCategoryItemProps {
  category: AdminFaqCategory;
  index: number;
  ws: string;
  product: string;
  onRename: (category: AdminFaqCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddQuestion: (categoryId: string) => void;
  onEditQuestion: (question: AdminFaqQuestion) => void;
  onDeleteQuestion: (questionId: string) => void;
}

export function FaqCategoryItem({
  category,
  index,
  ws,
  product,
  onRename,
  onDeleteCategory,
  onAddQuestion,
  onEditQuestion,
  onDeleteQuestion,
}: FaqCategoryItemProps): React.JSX.Element {
  const {
    ref: sortableRef,
    handleRef,
    isDragging,
  } = useSortable({
    id: category.id,
    index,
    group: "categories",
  });

  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: category.id,
  });

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const handleDelete = async () => {
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/categories/${encodeURIComponent(category.id)}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Category deleted");
      onDeleteCategory(category.id);
    } catch (err: any) {
      toast.error(errorCopy(err));
      throw err;
    }
  };

  return (
    <>
      <div
        ref={sortableRef}
        className={cn(
          "bg-card border border-border rounded-lg shadow-xs transition-all",
          isDragging && "opacity-60 shadow-lg ring-2 ring-primary/40 z-10"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-muted/20 rounded-t-lg">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              ref={handleRef}
              aria-label="Drag to reorder category"
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
            <h3
              className="text-base font-semibold text-foreground truncate"
              title={category.name}
            >
              {category.name}
            </h3>
            <Badge variant="neutral" className="tabular-nums text-xs shrink-0">
              {category.questions.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddQuestion(category.id)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add question
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label="Category options"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRename(category)}>
                  <Pencil className="size-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Droppable Question Area */}
        <div
          ref={droppableRef}
          className={cn(
            "p-3 flex flex-col gap-2.5 min-h-[70px] rounded-b-lg transition-colors",
            isDropTarget && "bg-muted/40 ring-1 ring-primary/30"
          )}
        >
          {category.questions.length === 0 ? (
            <div className="border border-dashed border-border/80 rounded-md p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
              <span>No questions in this category yet.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddQuestion(category.id)}
                className="text-xs h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                + Add question
              </Button>
            </div>
          ) : (
            category.questions.map((question, qIdx) => (
              <FaqQuestionItem
                key={question.id}
                question={question}
                index={qIdx}
                ws={ws}
                product={product}
                onEdit={onEditQuestion}
                onDelete={onDeleteQuestion}
              />
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete category"
        description="Are you sure you want to delete this FAQ category and all its questions? This cannot be undone."
        dismissLabel="Cancel"
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={handleDelete}
      />
    </>
  );
}
