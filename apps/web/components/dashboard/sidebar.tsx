"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Plus,
  SlidersHorizontal,
  ExternalLink,
  Settings,
  MessagesSquare,
  Kanban,
  Megaphone,
  HelpCircle,
} from "lucide-react";
import type { ProductSummary } from "@userhq/types";
import { cn } from "../../lib/utils";
import { portalHref } from "../../lib/tenant";
import { EntityLogo } from "../entity-logo";
import { Button } from "../ui/button";

export interface DashboardSidebarProps {
  ws: string;
  products?: ProductSummary[];
  className?: string;
}

export function DashboardSidebar({
  ws,
  products = [],
  className,
}: DashboardSidebarProps): React.JSX.Element {
  const pathname = usePathname();

  const isOverviewActive = pathname === `/dashboard/${ws}`;
  const isTeamActive = pathname === `/dashboard/${ws}/team`;
  const isWorkspaceSettingsActive = pathname === `/dashboard/${ws}/settings`;

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn("flex flex-col gap-6 w-full", className)}
    >
      <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
          Workspace
        </div>

        <Link
          href={`/dashboard/${ws}`}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
            isOverviewActive && "bg-background font-semibold"
          )}
          aria-current={isOverviewActive ? "page" : undefined}
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Overview</span>
        </Link>

        <Link
          href={`/dashboard/${ws}/team`}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
            isTeamActive && "bg-background font-semibold"
          )}
          aria-current={isTeamActive ? "page" : undefined}
        >
          <Users className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Team</span>
        </Link>

        <Link
          href={`/dashboard/${ws}/settings`}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
            isWorkspaceSettingsActive && "bg-background font-semibold"
          )}
          aria-current={isWorkspaceSettingsActive ? "page" : undefined}
        >
          <Settings className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Settings</span>
        </Link>
      </nav>

      <nav aria-label="Products navigation" className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-3 mb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Products
          </span>
          <Button variant="ghost" size="icon" className="size-5" asChild>
            <Link
              href={`/dashboard/${ws}/new`}
              aria-label="Add new product"
              title="Add new product"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="text-sm text-muted-foreground px-3">
            No products yet
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {products.map((product) => {
              const boardHref = `/dashboard/${ws}/${product.slug}/board`;
              const roadmapHref = `/dashboard/${ws}/${product.slug}/roadmap`;
              const changelogHref = `/dashboard/${ws}/${product.slug}/changelog`;
              const faqHref = `/dashboard/${ws}/${product.slug}/faq`;
              const categoriesHref = `/dashboard/${ws}/${product.slug}/categories`;
              const statusesHref = `/dashboard/${ws}/${product.slug}/statuses`;
              const settingsHref = `/dashboard/${ws}/${product.slug}/settings`;

              const isProductActive = pathname.startsWith(
                `/dashboard/${ws}/${product.slug}`
              );
              const isBoardActive =
                pathname === boardHref ||
                pathname.startsWith(`${boardHref}/`) ||
                pathname === categoriesHref ||
                pathname.startsWith(`${categoriesHref}/`);
              const isRoadmapActive =
                pathname === roadmapHref ||
                pathname.startsWith(`${roadmapHref}/`) ||
                pathname === statusesHref ||
                pathname.startsWith(`${statusesHref}/`);
              const isChangelogActive =
                pathname === changelogHref || pathname.startsWith(`${changelogHref}/`);
              const isFaqActive =
                pathname === faqHref || pathname.startsWith(`${faqHref}/`);
              const isSettingsActive = pathname === settingsHref;

              return (
                <div key={product.slug} className="flex flex-col gap-0.5">
                  <Link
                    href={boardHref}
                    className={cn(
                      "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
                      isProductActive && "bg-background font-semibold"
                    )}
                    aria-current={isProductActive ? "page" : undefined}
                  >
                    <EntityLogo
                      src={product.logoUrl}
                      name={product.name}
                      size={20}
                      style={
                        {
                          "--entity-accent": product.accentColor,
                        } as React.CSSProperties
                      }
                    />
                    <span className="truncate">{product.name}</span>
                  </Link>

                  {isProductActive && (
                    <div className="flex flex-col gap-0.5 pl-7">
                      <Link
                        href={boardHref}
                        className={cn(
                          "flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50",
                          isBoardActive && "text-foreground font-semibold bg-background/50"
                        )}
                        aria-current={isBoardActive ? "page" : undefined}
                      >
                        <MessagesSquare
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">Board</span>
                      </Link>

                      <Link
                        href={roadmapHref}
                        className={cn(
                          "flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50",
                          isRoadmapActive && "text-foreground font-semibold bg-background/50"
                        )}
                        aria-current={isRoadmapActive ? "page" : undefined}
                      >
                        <Kanban
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">Roadmap</span>
                      </Link>

                      <Link
                        href={changelogHref}
                        className={cn(
                          "flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50",
                          isChangelogActive && "text-foreground font-semibold bg-background/50"
                        )}
                        aria-current={isChangelogActive ? "page" : undefined}
                      >
                        <Megaphone
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">Changelog</span>
                      </Link>

                      <Link
                        href={faqHref}
                        className={cn(
                          "flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50",
                          isFaqActive && "text-foreground font-semibold bg-background/50"
                        )}
                        aria-current={isFaqActive ? "page" : undefined}
                      >
                        <HelpCircle
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">FAQ</span>
                      </Link>

                      <Link
                        href={settingsHref}
                        className={cn(
                          "flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50",
                          isSettingsActive && "text-foreground font-semibold bg-background/50"
                        )}
                        aria-current={isSettingsActive ? "page" : undefined}
                      >
                        <SlidersHorizontal
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">Settings</span>
                      </Link>

                      <a
                        href={portalHref(ws, product.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-background/50"
                      >
                        <ExternalLink
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">View portal</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
