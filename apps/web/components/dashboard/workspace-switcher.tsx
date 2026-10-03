"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { EntityLogo } from "../entity-logo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

export interface MeWorkspace {
  slug: string;
  name: string;
  logoUrl?: string | null;
  role?: string;
}

export interface WorkspaceSwitcherProps {
  current: {
    slug: string;
    name: string;
    logoUrl?: string | null;
  };
  workspaces: MeWorkspace[];
  canCreate: boolean;
}

export function WorkspaceSwitcher({
  current,
  workspaces,
  canCreate,
}: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 px-2 gap-2 max-w-60 min-w-0 shrink justify-start"
          aria-label={`Switch workspace, current: ${current.name}`}
        >
          <EntityLogo src={current.logoUrl} name={current.name} size={24} />
          <span className="text-sm font-semibold truncate text-foreground min-w-0">
            {current.name}
          </span>
          <ChevronsUpDown
            className="size-4 shrink-0 text-muted-foreground ml-auto"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} forceMount>
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
          Workspaces
        </DropdownMenuLabel>
        <div className="max-h-96 overflow-y-auto flex flex-col gap-0.5">
          {workspaces.map((ws) => {
            const isCurrent = ws.slug === current.slug;
            return (
              <DropdownMenuItem asChild key={ws.slug}>
                <Link
                  href={`/dashboard/${ws.slug}`}
                  className="flex items-center gap-2 w-full"
                >
                  <EntityLogo src={ws.logoUrl} name={ws.name} size={20} />
                  <span className="truncate flex-1">{ws.name}</span>
                  {isCurrent && (
                    <Check
                      className="size-4 shrink-0 text-foreground ml-auto"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>

        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/new"
                className="flex items-center gap-2 w-full"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span>Create workspace</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
