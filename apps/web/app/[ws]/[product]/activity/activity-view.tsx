"use client";

import * as React from "react";
import type { ActivityItem } from "@userhq/types";
import { ActivityFeed } from "@/components/activity/activity-feed";

export interface ActivityViewProps {
  ws: string;
  product: string;
  productName: string;
  activities: ActivityItem[];
}

export function ActivityView({
  ws,
  product,
  productName,
  activities,
}: ActivityViewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          My activity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Posts you created, upvoted, or commented on for {productName}.
        </p>
      </div>

      <ActivityFeed ws={ws} product={product} activities={activities} />
    </div>
  );
}
