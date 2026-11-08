"use client";

import * as React from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../lib/utils";
import { type ThemePreference } from "../lib/theme";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ThemeToggleProps {
  variant?: "dropdown" | "segmented";
  className?: string;
  align?: "start" | "center" | "end";
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle({
  variant = "dropdown",
  className,
  align = "end",
}: ThemeToggleProps): React.JSX.Element {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Pick active trigger icon
  const ActiveIcon =
    theme === "system"
      ? Monitor
      : resolvedTheme === "dark"
      ? Moon
      : Sun;

  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Appearance preference"
        className={cn(
          "inline-flex items-center gap-1 p-1 bg-muted/60 border border-border/80 rounded-lg text-xs font-medium text-muted-foreground",
          className
        )}
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all motion-press focus-visible:outline-2 focus-visible:outline-ring",
                isSelected
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: currently ${theme}. Open theme menu`}
          className={cn("size-8 rounded-md text-muted-foreground hover:text-foreground", className)}
        >
          <ActiveIcon className="size-4 shrink-0 transition-transform duration-200" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} sideOffset={6} className="w-36">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{opt.label}</span>
              </span>
              {isSelected && <Check className="size-3.5 text-[var(--primary-text)] shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
