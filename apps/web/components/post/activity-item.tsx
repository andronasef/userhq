import * as React from "react";
import { CircleDot } from "lucide-react";
import type { ActivityEntry } from "@userhq/types";
import { StatusBadge } from "@/components/status-badge";
import { PlainText } from "@/components/plain-text";
import { formatDate } from "@/lib/format";

export interface ActivityItemProps {
  activity: ActivityEntry;
}

export function ActivityItem({ activity }: ActivityItemProps): React.JSX.Element {
  const actorName = activity.actor.deleted
    ? "Deleted user"
    : (activity.actor.name ?? "Anonymous");

  return (
    <li className="flex gap-4">
      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <CircleDot className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-foreground">{actorName}</span>
          <span className="text-muted-foreground">changed the status to</span>
          <StatusBadge name={activity.statusName} color={activity.statusColor} />
          <span className="text-muted-foreground">·</span>
          <time
            dateTime={activity.createdAt}
            title={activity.createdAt}
            className="text-muted-foreground"
          >
            {formatDate(activity.createdAt)}
          </time>
        </div>
        {activity.note && (
          <div className="mt-2 rounded-lg bg-muted p-4 text-sm text-foreground">
            <PlainText text={activity.note} />
          </div>
        )}
      </div>
    </li>
  );
}
