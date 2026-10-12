"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface FaqSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  className?: string;
}

export function FaqSearchBar({
  value,
  onChange,
  matchCount,
  className,
}: FaqSearchBarProps): React.JSX.Element {
  const hasQuery = value.trim().length > 0;

  return (
    <div className={cn("max-w-2xl mx-auto mb-8 w-full", className)}>
      <div className="relative flex items-center">
        <Search
          className="absolute left-3.5 size-5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          role="searchbox"
          placeholder="Search frequently asked questions..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 px-4 pl-11 pr-10 rounded-lg border border-input bg-background shadow-xs text-base"
          aria-label="Search frequently asked questions"
        />
        {hasQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            className="absolute right-2 size-7 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {hasQuery && (
        <p className="text-xs text-muted-foreground mt-2 px-1">
          {matchCount === 0
            ? "No matching questions found"
            : matchCount === 1
            ? "Found 1 matching answer"
            : `Found ${matchCount} matching answers`}
        </p>
      )}
    </div>
  );
}
