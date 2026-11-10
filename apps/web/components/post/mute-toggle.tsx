"use client";

import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { MuteResultSchema, type MuteResult } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

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
  const { t } = useI18n();
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
        toast.success(t("post.muteSuccess"));
      } else {
        toast.success(t("post.unmuteSuccess"));
      }
    } catch {
      toast.error(t("common.errorGeneric"));
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
      aria-label={t("post.muteLabel")}
    >
      {muted ? (
        <>
          <BellOff className="size-4 mr-1.5" aria-hidden="true" />
          <span>{t("post.unmute")}</span>
        </>
      ) : (
        <>
          <Bell className="size-4 mr-1.5" aria-hidden="true" />
          <span>{t("post.mute")}</span>
        </>
      )}
    </Button>
  );
}
