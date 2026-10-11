"use client";

import * as React from "react";
import { Eye, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { type Status, StatusSchema } from "@userhq/types";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { apiFetch } from "../../lib/api-client";

export interface PublicColumnsPopoverProps {
  ws: string;
  product: string;
  statuses: Status[];
  onStatusesChange: (statuses: Status[]) => void;
}

export function PublicColumnsPopover({
  ws,
  product,
  statuses,
  onStatusesChange,
}: PublicColumnsPopoverProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const publicCount = statuses.filter((s) => s.isPublicRoadmap).length;

  const handleToggle = async (status: Status) => {
    const nextValue = !status.isPublicRoadmap;
    setUpdatingId(status.id);

    try {
      const updated = await apiFetch<Status>(
        `/api/v1/workspaces/${ws}/products/${product}/statuses/${status.id}`,
        {
          method: "PATCH",
          body: { isPublicRoadmap: nextValue },
          schema: StatusSchema,
        }
      );

      const nextList = statuses.map((s) => (s.id === status.id ? updated : s));
      onStatusesChange(nextList);
      toast.success(
        nextValue
          ? `Added "${status.name}" to public roadmap`
          : `Removed "${status.name}" from public roadmap`
      );
    } catch {
      toast.error("Couldn't update status visibility. Try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Public columns</span>
          <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {publicCount}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1">
          Choose which status columns appear on your public roadmap.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          {statuses.map((status) => (
            <label
              key={status.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={status.isPublicRoadmap}
                disabled={updatingId === status.id}
                onChange={() => handleToggle(status)}
                className="size-4 rounded border-border text-primary focus:ring-ring"
              />
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: status.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate font-medium text-foreground">
                {status.name}
              </span>
              {updatingId === status.id && (
                <LoaderCircle className="size-3 animate-spin text-muted-foreground shrink-0" />
              )}
            </label>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
