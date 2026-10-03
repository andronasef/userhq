"use client";

import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { MuteResultSchema, type MuteResult } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export interface MuteToggleProps {
  ws: string;
  product: string;
  postNumber: number;
  initialMuted: boolean;
}

export function MuteToggle({
  ws,
  product,
  postNumber,
  initialMuted,
}: MuteToggleProps): React.JSX.Element {
  const [muted, setMuted] = React.useState(initialMuted);
  const [isPending, setIsPending] = React.useState(false);

  const handleToggle = async () => {
    setIsPending(true);
    const nextAction = muted ? "DELETE" : "PUT";
    try {
      const res = await apiFetch<MuteResult>(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts/${postNumber}/mute`,
        {
          method: nextAction,
          schema: MuteResultSchema,
        }
      );
      setMuted(res.muted);
      if (res.muted) {
        toast.success("You won't get emails about this post");
      } else {
        toast.success("You'll get emails about new comments on this post");
      }
    } catch {
      toast.error("Something went wrong on our end. Try again in a moment.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      aria-pressed={muted}
      aria-label="Mute email for this post"
    >
      {muted ? (
        <>
          <BellOff className="size-4 mr-1.5" aria-hidden="true" />
          <span>Unmute</span>
        </>
      ) : (
        <>
          <Bell className="size-4 mr-1.5" aria-hidden="true" />
          <span>Mute</span>
        </>
      )}
    </Button>
  );
}
