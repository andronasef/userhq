"use client";

import * as React from "react";
import type { PublicFaqCategory } from "@userhq/types";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export interface FaqSidebarNavProps {
  categories: PublicFaqCategory[];
  activeCategoryId?: string | null;
  onSelectCategory?: (id: string) => void;
  className?: string;
}

export function FaqSidebarNav({
  categories,
  activeCategoryId,
  onSelectCategory,
  className,
}: FaqSidebarNavProps): React.JSX.Element {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    onSelectCategory?.(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <nav
      aria-label="FAQ categories"
      className={cn(
        "hidden lg:block lg:col-span-4 sticky top-24 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2",
        className
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
        Categories
      </p>
      {categories.map((cat) => {
        const isActive = activeCategoryId === cat.id;
        return (
          <a
            key={cat.id}
            href={`#${cat.id}`}
            onClick={(e) => handleClick(e, cat.id)}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className="truncate mr-2">{cat.name}</span>
            <Badge variant="neutral" className="tabular-nums text-xs shrink-0">
              {cat.questions.length}
            </Badge>
          </a>
        );
      })}
    </nav>
  );
}
