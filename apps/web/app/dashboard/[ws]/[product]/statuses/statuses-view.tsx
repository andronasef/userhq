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
}

export function StatusesView({
  ws,
  product,
  initial,
}: StatusesViewProps): React.JSX.Element {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statuses"
        description="Statuses show where each post stands. Drag to change the order customers see."
        action={
          <Button onClick={() => setAddDialogOpen(true)}>
            Add status
          </Button>
        }
      />

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
