"use client";

import * as React from "react";
import { toast } from "sonner";
import type { AdminFaqCategory } from "@userhq/types";
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
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface FaqCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AdminFaqCategory | null;
  ws: string;
  product: string;
  onSuccess: (category: AdminFaqCategory) => void;
}

export function FaqCategoryDialog({
  open,
  onOpenChange,
  category,
  ws,
  product,
  onSuccess,
}: FaqCategoryDialogProps): React.JSX.Element {
  const isEditing = Boolean(category);
  const [name, setName] = React.useState(category?.name ?? "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(category ? category.name : "");
      setError(null);
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a category name.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Enter a category name.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Keep it under 50 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && category) {
        const updated = await apiFetch<AdminFaqCategory>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/categories/${encodeURIComponent(category.id)}`,
          {
            method: "PATCH",
            body: { name: trimmed },
          }
        );
        toast.success("Category updated");
        onSuccess(updated);
      } else {
        const created = await apiFetch<AdminFaqCategory>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/faq/categories`,
          {
            method: "POST",
            body: { name: trimmed },
          }
        );
        toast.success("Category created");
        onSuccess(created);
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = errorCopy(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Rename category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the name of this FAQ category."
              : "Add an FAQ category to organize self-serve help articles."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field id="faq-category-name" label="Category name" error={error ?? undefined}>
            <Input
              type="text"
              placeholder="e.g. Account & Billing"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              minLength={2}
              maxLength={50}
              autoFocus
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                ? "Save category"
                : "New category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
