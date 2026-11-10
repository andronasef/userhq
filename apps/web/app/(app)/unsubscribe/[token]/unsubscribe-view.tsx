"use client";

import * as React from "react";
import Link from "next/link";
import {
  UnsubscribeStateSchema,
  type UnsubscribeState,
} from "@userhq/types";
import { type ApiReadResult } from "@/lib/api-server";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatePage } from "@/components/state-page";
import { useI18n } from "@/lib/i18n/context";

export interface UnsubscribeViewProps {
  token: string;
  initialResult: ApiReadResult<UnsubscribeState>;
}

export function UnsubscribeView({
  token,
  initialResult,
}: UnsubscribeViewProps): React.JSX.Element {
  const { t } = useI18n();
  const [data, setData] = React.useState<UnsubscribeState | null>(
    initialResult.ok ? initialResult.data : null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const handlePost = async () => {
    setIsSubmitting(true);
    setHasError(false);
    try {
      const updated = await apiFetch(
        `/api/v1/unsubscribe/${encodeURIComponent(token)}`,
        {
          method: "POST",
          schema: UnsubscribeStateSchema,
        }
      );
      setData(updated);
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setHasError(false);
    try {
      const updated = await apiFetch(
        `/api/v1/unsubscribe/${encodeURIComponent(token)}`,
        {
          method: "DELETE",
          schema: UnsubscribeStateSchema,
        }
      );
      setData(updated);
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) {
    return (
      <StatePage
        title={t("unsubscribe.invalidLinkTitle")}
        body={t("unsubscribe.invalidLinkBody")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/account">{t("unsubscribe.goToAccountSettings")}</Link>
          </Button>
        }
      />
    );
  }

  let title = "";
  let body = "";
  let actionsNode: React.ReactNode = null;

  if (data.scope === "all") {
    if (data.state === "subscribed") {
      title = t("unsubscribe.turnOffAllTitle");
      body = t("unsubscribe.turnOffAllBody");
      actionsNode = (
        <Button onClick={handlePost} disabled={isSubmitting}>
          {isSubmitting ? t("unsubscribe.turningOff") : t("unsubscribe.turnOffAllBtn")}
        </Button>
      );
    } else {
      title = t("unsubscribe.commentEmailsOffTitle");
      body = t("unsubscribe.commentEmailsOffBody");
      actionsNode = (
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("unsubscribe.turningOn") : t("unsubscribe.turnEmailsBackOn")}
        </Button>
      );
    }
  } else {
    // scope === "post"
    if (data.state === "post_unavailable") {
      title = t("unsubscribe.postUnavailableTitle");
      body = t("unsubscribe.postUnavailableBody");
      actionsNode = (
        <Button variant="outline" asChild>
          <Link href="/account">{t("unsubscribe.goToAccountSettings")}</Link>
        </Button>
      );
    } else if (data.state === "subscribed") {
      title = t("unsubscribe.mutePostTitle", {
        title: data.postTitle ?? t("unsubscribe.thisPost"),
      });
      body = t("unsubscribe.mutePostBody");
      actionsNode = (
        <Button onClick={handlePost} disabled={isSubmitting}>
          {isSubmitting ? t("unsubscribe.muting") : t("unsubscribe.mutePostBtn")}
        </Button>
      );
    } else {
      title = t("unsubscribe.postMutedTitle");
      body = t("unsubscribe.postMutedBody");
      actionsNode = (
        <div className="flex flex-wrap gap-2">
          {data.postUrl && (
            <Button variant="outline" asChild>
              <Link href={data.postUrl}>{t("unsubscribe.viewPost")}</Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("unsubscribe.unmuting") : t("unsubscribe.unmute")}
          </Button>
        </div>
      );
    }
  }

  const actions = (
    <div className="flex w-full flex-col gap-4">
      {hasError && (
        <Alert variant="destructive">
          <div>{t("unsubscribe.errorAlert")}</div>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">{actionsNode}</div>
    </div>
  );

  return <StatePage title={title} body={body} actions={actions} />;
}
