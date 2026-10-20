"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@userhq/types";
import { PageHeader } from "../../../../../components/page-header";
import { Button } from "../../../../../components/ui/button";
import { CategoryList } from "../../../../../components/dashboard/category-list";
import { CategoryDialog } from "../../../../../components/dashboard/category-dialog";

export interface CategoriesViewProps {
  ws: string;
  product: string;
  initial: Category[];
  showHeader?: boolean;
}

export function CategoriesView({
  ws,
  product,
  initial,
  showHeader = true,
}: CategoriesViewProps): React.JSX.Element {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  return (
    <div className="space-y-6 max-w-5xl">
      {showHeader ? (
        <PageHeader
          title="Categories"
          description="Group feedback by topic so customers can find and file related ideas."
          action={
            <Button onClick={() => setAddDialogOpen(true)}>
              Add category
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Group feedback by topic so customers can find and file related ideas.
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="self-start sm:self-auto">
            Add category
          </Button>
        </div>
      )}

      <CategoryList
        ws={ws}
        product={product}
        categories={initial}
        onAddCategory={() => setAddDialogOpen(true)}
      />

      <CategoryDialog
        mode="add"
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSaved={() => {
          router.refresh();
        }}
        ws={ws}
        product={product}
      />
    </div>
  );
}
