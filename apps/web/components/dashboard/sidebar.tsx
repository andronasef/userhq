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
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const isProductsActive = pathname === `/dashboard/${ws}`;
  const isTeamActive = pathname.startsWith(`/dashboard/${ws}/team`);

  return (
    <aside className={cn("flex flex-col gap-6", className)}>
      <nav aria-label="Workspace">
        <div className="text-xs font-semibold text-muted-foreground px-3 mb-1">
          Workspace
        </div>
        <Link
          href={`/dashboard/${ws}`}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
            isProductsActive && "bg-background font-semibold"
          )}
          aria-current={isProductsActive ? "page" : undefined}
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Products</span>
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
      </nav>

      <nav aria-label="Products">
        <div className="flex items-center justify-between px-3 mb-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Products
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href={`/dashboard/${ws}/new`} aria-label="New product">
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
              const settingsHref = `/dashboard/${ws}/${product.slug}/settings`;
              const isProductActive = pathname.startsWith(
                `/dashboard/${ws}/${product.slug}`
              );
              const isSettingsActive = pathname === settingsHref;

              return (
                <div key={product.slug} className="flex flex-col gap-0.5">
                  <Link
                    href={settingsHref}
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
