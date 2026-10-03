"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@userhq/types";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../empty-state";
import { CategoryDialog } from "./category-dialog";
import { apiFetch } from "../../lib/api-client";

export interface CategoryListProps {
  ws: string;
  product: string;
  categories: Category[];
  onCategoryChanged?: () => void;
  onAddCategory?: () => void;
}

export function CategoryList({
  ws,
  product,
  categories,
  onCategoryChanged,
  onAddCategory,
}: CategoryListProps): React.JSX.Element {
  const router = useRouter();
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = React.useState<Category | null>(null);
  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/categories/${encodeURIComponent(deletingCategory.id)}`,
        { method: "DELETE" }
      );
      toast.success(`${deletingCategory.name} deleted`);
      setDeletingCategory(null);
      if (onCategoryChanged) {
        onCategoryChanged();
      } else {
        router.refresh();
      }
      const heading = document.querySelector("h1");
      heading?.focus();
    } catch (err) {
      toast.error("Failed to delete category");
      throw err;
    }
  };

  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories"
        body="Categories help customers file their ideas. Posts work fine without them."
        action={
          onAddCategory ? (
            <Button onClick={onAddCategory}>Add category</Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <ul className="rounded-lg border border-border divide-y divide-border bg-card">
        {categories.map((cat) => {
          const postCountText =
            cat.postCount === 1 ? "1 post" : `${cat.postCount} posts`;

          return (
            <li
              key={cat.id}
              className="flex items-center justify-between gap-4 h-14 px-4"
            >
              <span className="text-sm font-medium text-foreground truncate">
                {cat.name}
              </span>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {postCountText}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Actions for ${cat.name}`}
                    >
                      <Ellipsis className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingCategory(cat)}>
                      Rename category
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => setDeletingCategory(cat)}
                    >
                      Delete category
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {editingCategory && (
        <CategoryDialog
          mode="rename"
          open={!!editingCategory}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
          initialCategory={editingCategory}
          ws={ws}
          product={product}
          onSaved={() => {
            setEditingCategory(null);
            if (onCategoryChanged) {
              onCategoryChanged();
            } else {
              router.refresh();
            }
          }}
        />
      )}

      {deletingCategory && (
        <ConfirmDialog
          open={!!deletingCategory}
          onOpenChange={(open) => {
            if (!open) setDeletingCategory(null);
          }}
          title={`Delete ${deletingCategory.name}?`}
          description={`Its ${deletingCategory.postCount} ${deletingCategory.postCount === 1 ? "post stays" : "posts stay"} on the board with no category.`}
          confirmLabel="Delete category"
          pendingLabel="Deleting…"
          dismissLabel="Keep category"
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}
