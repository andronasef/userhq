"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminFaqQuestion } from "@userhq/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { extractTextFromRichText } from "./faq-portal";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";
import { cn } from "../../lib/utils";

export interface FaqQuestionItemProps {
  question: AdminFaqQuestion;
  index: number;
  ws: string;
  product: string;
  onEdit: (question: AdminFaqQuestion) => void;
  onDelete: (questionId: string) => void;
}

export function FaqQuestionItem({
  question,
  index,
  ws,
  product,
  onEdit,
  onDelete,
}: FaqQuestionItemProps): React.JSX.Element {
  const { ref, handleRef, isDragging } = useSortable({
    id: question.id,
    index,
    group: question.categoryId,
  });

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const previewText = React.useMemo(() => {
    return extractTextFromRichText(question.answer);
  }, [question.answer]);

  const handleDelete = async () => {
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/questions/${encodeURIComponent(question.id)}`,
        {
          method: "DELETE",
        }
      );
      toast.success("Question deleted");
      onDelete(question.id);
    } catch (err: any) {
      toast.error(errorCopy(err));
      throw err;
    }
  };

  return (
    <>
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between gap-3 p-3 bg-background border border-border rounded-md shadow-2xs hover:border-foreground/20 transition-all",
          isDragging && "shadow-lg ring-2 ring-primary/40 opacity-70 z-20 bg-muted/40"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            ref={handleRef}
            aria-label="Drag to reorder question"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h4
              className="text-sm font-medium text-foreground truncate"
              title={question.question}
            >
              {question.question}
            </h4>
            {previewText && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {previewText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                aria-label="Question actions"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(question)}>
                <Pencil className="size-3.5 mr-2" />
                Edit
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete question"
        description="Are you sure you want to delete this FAQ question? This cannot be undone."
        dismissLabel="Cancel"
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={handleDelete}
      />
    </>
  );
}
