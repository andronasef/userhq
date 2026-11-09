"use client";

import * as React from "react";
import type { PublicAuthor, DeviceInfo } from "@userhq/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { DeviceBadge } from "@/components/post/device-badge";
import { useI18n } from "@/lib/i18n/context";

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
  const { locale, t } = useI18n();
  const isDeleted = author.deleted;
  const avatarSrc = isDeleted ? null : author.image;
  const avatarName = isDeleted ? "" : (author.name ?? "");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Avatar src={avatarSrc} name={avatarName} size="sm" />
      {isDeleted ? (
        <span className="text-sm font-semibold text-muted-foreground">
          {t("ui.deletedUser")}
        </span>
      ) : (
        <>
          <span className="text-sm font-semibold text-foreground">
            {author.name ?? t("ui.anonymous")}
          </span>
          {author.isAdmin && <Badge variant="neutral">{t("ui.adminBadge")}</Badge>}
        </>
      )}
      <time
        dateTime={createdAt}
        title={createdAt}
        className="text-sm text-muted-foreground"
      >
        {formatDate(createdAt, locale)}
      </time>
      {editedAt && (
        <span
          className="text-xs text-muted-foreground font-normal"
          title={`Edited ${formatDate(editedAt, locale)}`}
        >
          · {t("ui.editedBadge")}
        </span>
      )}
      {deviceInfo && <DeviceBadge deviceInfo={deviceInfo} />}
    </div>
  );
}
