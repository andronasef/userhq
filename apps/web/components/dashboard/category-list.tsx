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
import { useI18n } from "../../lib/i18n/context";

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
  const { t } = useI18n();
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
      toast.success(t("categories.deleteCategoryNamed", { name: deletingCategory.name }));
      setDeletingCategory(null);
      if (onCategoryChanged) {
        onCategoryChanged();
      } else {
        router.refresh();
      }
      const heading = document.querySelector("h1");
      heading?.focus();
    } catch (err) {
      toast.error(t("categories.deleteFailed"));
      throw err;
    }
  };

  if (categories.length === 0) {
    return (
      <EmptyState
        title={t("categories.noCategoriesTitle")}
        body={t("categories.noCategoriesBody")}
        action={
          onAddCategory ? (
            <Button onClick={onAddCategory}>{t("categories.addCategory")}</Button>
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
            cat.postCount === 1 ? t("categories.postCountOne") : t("categories.postCountOther", { count: cat.postCount });

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
                      aria-label={t("categories.actionsFor", { name: cat.name })}
                    >
                      <Ellipsis className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingCategory(cat)}>
                      {t("categories.renameCategory")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => setDeletingCategory(cat)}
                    >
                      {t("categories.deleteCategory")}
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
          title={t("categories.deleteDialogTitle", { name: deletingCategory.name })}
          description={t("categories.deleteDialogDesc", { count: deletingCategory.postCount })}
          confirmLabel={t("categories.deleteCategory")}
          pendingLabel={t("common.deleting")}
          dismissLabel={t("common.cancel")}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}
