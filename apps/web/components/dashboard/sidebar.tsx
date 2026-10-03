"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "../../lib/utils";
import { EntityLogo } from "../entity-logo";

export interface ProductSummary {
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string;
}

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
      </nav>

      <nav aria-label="Products">
        <div className="text-xs font-semibold text-muted-foreground px-3 mb-1">
          Products
        </div>
        {products.length === 0 ? (
          <div className="text-sm text-muted-foreground px-3">
            No products yet
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {products.map((product) => {
              const href = `/dashboard/${ws}/${product.slug}/statuses`;
              const isActive = pathname.startsWith(`/dashboard/${ws}/${product.slug}`);
              return (
                <Link
                  key={product.slug}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-md text-sm text-foreground hover:bg-background",
                    isActive && "bg-background font-semibold"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <EntityLogo
                    src={product.logoUrl}
                    name={product.name}
                    size={20}
                  />
                  <span className="truncate">{product.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
