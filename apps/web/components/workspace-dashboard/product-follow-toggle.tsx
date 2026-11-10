"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { apiFetch } from "../../lib/api-client";
import { useI18n } from "../../lib/i18n/context";

export function setProductFollow(ws: string, productSlug: string, follow: boolean): Promise<unknown> {
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(productSlug)}/push-follow`,
    // apiFetch defaults to GET when there is no body, so the method is explicit.
    { method: follow ? "POST" : "DELETE" }
  );
}

/** Optimistic update with rollback; the component only wires React state into the hooks. */
export async function changeFollow(
  ws: string,
  productSlug: string,
  next: boolean,
  ui: { setFollowing(v: boolean): void; setPending(v: boolean): void; onError(message: string): void },
  errorMsg?: string
): Promise<void> {
  ui.setPending(true);
  ui.setFollowing(next);
  try {
    await setProductFollow(ws, productSlug, next);
  } catch {
    ui.setFollowing(!next);
    ui.onError(errorMsg ?? (next ? "Could not follow this product." : "Could not unfollow this product."));
  } finally {
    ui.setPending(false);
  }
}

interface ProductFollowToggleProps {
  ws: string;
  productSlug: string;
  productName: string;
  initialFollowing: boolean;
}

export function ProductFollowToggle({
  ws,
  productSlug,
  productName,
  initialFollowing,
}: ProductFollowToggleProps): React.JSX.Element {
  const { t } = useI18n();
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      type="button"
      variant={following ? "default" : "outline"}
      size="sm"
      aria-pressed={following}
      aria-label={t("workspace.followProductAria", { name: productName })}
      disabled={pending}
      onClick={() =>
        void changeFollow(
          ws,
          productSlug,
          !following,
          { setFollowing, setPending, onError: toast.error },
          !following ? t("workspace.followError") : t("workspace.unfollowError")
        )
      }
    >
      {following ? t("workspace.following") : t("workspace.follow")}
    </Button>
  );
}
