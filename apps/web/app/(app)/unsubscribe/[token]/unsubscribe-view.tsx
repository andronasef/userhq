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

export interface UnsubscribeViewProps {
  token: string;
  initialResult: ApiReadResult<UnsubscribeState>;
}

export function UnsubscribeView({
  token,
  initialResult,
}: UnsubscribeViewProps): React.JSX.Element {
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
        title="This link isn't valid"
        body="Check that you opened the whole link from the email. You can also manage comment emails in your account settings."
        actions={
          <Button variant="outline" asChild>
            <Link href="/account">Go to account settings</Link>
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
      title = "Turn off comment emails?";
      body =
        "You'll stop getting emails about new comments on posts you're part of, from every company on UserHQ.";
      actionsNode = (
        <Button onClick={handlePost} disabled={isSubmitting}>
          {isSubmitting ? "Turning off…" : "Turn off comment emails"}
        </Button>
      );
    } else {
      title = "Comment emails are off";
      body = "You can turn them back on here or in your account settings.";
      actionsNode = (
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Turning on…" : "Turn emails back on"}
        </Button>
      );
    }
  } else {
    // scope === "post"
    if (data.state === "post_unavailable") {
      title = "This post is no longer available";
      body =
        "It may have been deleted or merged. You can manage comment emails in your account settings.";
      actionsNode = (
        <Button variant="outline" asChild>
          <Link href="/account">Go to account settings</Link>
        </Button>
      );
    } else if (data.state === "subscribed") {
      title = `Mute "${data.postTitle ?? "this post"}"?`;
      body =
        "You'll stop getting emails about new comments on this post. Other posts aren't affected.";
      actionsNode = (
        <Button onClick={handlePost} disabled={isSubmitting}>
          {isSubmitting ? "Muting…" : "Mute this post"}
        </Button>
      );
    } else {
      title = "This post is muted";
      body = "To get emails about it again, use the bell on the post page.";
      actionsNode = (
        <div className="flex flex-wrap gap-2">
          {data.postUrl && (
            <Button variant="outline" asChild>
              <Link href={data.postUrl}>View post</Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Unmuting…" : "Unmute"}
          </Button>
        </div>
      );
    }
  }

  const actions = (
    <div className="flex w-full flex-col gap-4">
      {hasError && (
        <Alert variant="destructive">
          <div>Something went wrong on our end. Try again in a moment.</div>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">{actionsNode}</div>
    </div>
  );

  return <StatePage title={title} body={body} actions={actions} />;
}
