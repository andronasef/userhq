"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Status } from "@userhq/types";
import { PageHeader } from "../../../../../components/page-header";
import { Button } from "../../../../../components/ui/button";
import { SortableStatusList } from "../../../../../components/dashboard/status-list";
import { StatusDialog } from "../../../../../components/dashboard/status-dialog";

export interface StatusesViewProps {
  ws: string;
  product: string;
  initial: Status[];
  showHeader?: boolean;
}

export function StatusesView({
  ws,
  product,
  initial,
  showHeader = true,
}: StatusesViewProps): React.JSX.Element {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  return (
    <div className="space-y-6 max-w-5xl">
      {showHeader ? (
        <PageHeader
          title="Statuses"
          description="Statuses show where each post stands. Drag to change the order customers see."
          action={
            <Button onClick={() => setAddDialogOpen(true)}>
              Add status
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Statuses show where each post stands. Drag to change the order customers see.
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="self-start sm:self-auto">
            Add status
          </Button>
        </div>
      )}

      <SortableStatusList ws={ws} product={product} initial={initial} />

      <StatusDialog
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
