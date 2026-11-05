"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DashboardTab {
  id: "products" | "requests" | "comments";
  label: string;
  count?: number;
  badge?: number;
  href: string;
}

export interface WorkspaceDashboardTabsProps {
  tabs: DashboardTab[];
  activeTab: "products" | "requests" | "comments";
  className?: string;
}

export function WorkspaceDashboardTabs({
  tabs,
  activeTab,
  className,
}: WorkspaceDashboardTabsProps): React.JSX.Element {
  return (
    <nav
      className={cn(
        "flex gap-6 border-b border-border overflow-x-auto overflow-y-hidden no-scrollbar",
        className
      )}
      aria-label="Workspace Dashboard Tabs"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-10 inline-flex items-center gap-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-medium",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
