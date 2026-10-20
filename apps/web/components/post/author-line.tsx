import * as React from "react";
import type { PublicAuthor, DeviceInfo } from "@userhq/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { DeviceBadge } from "@/components/post/device-badge";

export interface AuthorLineProps {
  author: PublicAuthor;
  createdAt: string;
  editedAt?: string | null;
  deviceInfo?: DeviceInfo | null;
}

export function AuthorLine({
  author,
  createdAt,
  editedAt,
  deviceInfo,
}: AuthorLineProps): React.JSX.Element {
  const isDeleted = author.deleted;
  const avatarSrc = isDeleted ? null : author.image;
  const avatarName = isDeleted ? "" : (author.name ?? "");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Avatar src={avatarSrc} name={avatarName} size="sm" />
      {isDeleted ? (
        <span className="text-sm font-semibold text-muted-foreground">
          Deleted user
        </span>
      ) : (
        <>
          <span className="text-sm font-semibold text-foreground">
            {author.name ?? "Anonymous"}
          </span>
          {author.isAdmin && <Badge variant="neutral">Admin</Badge>}
        </>
      )}
      <time
        dateTime={createdAt}
        title={createdAt}
        className="text-sm text-muted-foreground"
      >
        {formatDate(createdAt)}
      </time>
      {editedAt && (
        <span
          className="text-xs text-muted-foreground font-normal"
          title={`Edited ${formatDate(editedAt)}`}
        >
          · edited
        </span>
      )}
      {deviceInfo && <DeviceBadge deviceInfo={deviceInfo} />}
    </div>
  );
}
