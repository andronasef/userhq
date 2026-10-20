"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EntityLogo } from "./entity-logo";
import { safeNext } from "../lib/safe-next";
import { accentTokens } from "../lib/accent";

export interface ActiveProjectInfo {
  name: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  wsName?: string;
  href: string;
}

export function HeaderBrand(): React.JSX.Element {
  const pathname = usePathname();
  const [project, setProject] = React.useState<ActiveProjectInfo | null>(null);

  React.useEffect(() => {
    try {
      // 1. Check URL query param 'back' on current page (e.g. /account?back=...)
      let backPath: string | null = null;
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        backPath = sp.get("back");
      }

      // 2. Check sessionStorage for exact active project metadata
      const rawStored = sessionStorage.getItem("userhq_active_project");
      if (rawStored) {
        const parsed = JSON.parse(rawStored) as ActiveProjectInfo;
        if (parsed?.name && parsed?.href) {
          setProject(parsed);
          return;
        }
      }

      // 3. Fallback: derive project name and href from backPath or last return path
      const candidatePath = backPath || sessionStorage.getItem("userhq_last_return");
      if (candidatePath) {
        const sanitized = safeNext(candidatePath, "");
        if (
          sanitized &&
          sanitized !== "/account" &&
          sanitized !== "/login" &&
          sanitized !== "/"
        ) {
          const parts = sanitized.split("/").filter(Boolean);
          // If dashboard: /dashboard/[ws]/[product]/...
          if (parts[0] === "dashboard" && parts.length >= 3) {
            const prodSlug = parts[2];
            const name =
              prodSlug.charAt(0).toUpperCase() +
              prodSlug.slice(1).replace(/-/g, " ");
            setProject({
              name,
              href: sanitized,
            });
            return;
          }
          // If portal: /[ws]/[product]/...
          if (
            parts.length >= 2 &&
            !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(
              parts[0]
            )
          ) {
            const prodSlug = parts[1];
            const name =
              prodSlug.charAt(0).toUpperCase() +
              prodSlug.slice(1).replace(/-/g, " ");
            setProject({
              name,
              href: sanitized,
            });
            return;
          }
        }
      }
    } catch {
      // Ignore storage/parsing errors
    }
  }, [pathname]);

  if (project) {
    const accentStyle = project.accentColor
      ? ({
          "--entity-accent": accentTokens(project.accentColor).primary,
        } as React.CSSProperties)
      : undefined;

    return (
      <Link
        href={project.href}
        className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
      >
        <EntityLogo
          src={project.logoUrl}
          name={project.name}
          size={32}
          className="shrink-0"
          style={accentStyle}
        />
        <span className="text-base font-semibold truncate text-foreground">
          {project.name}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="text-base font-semibold text-foreground shrink-0 hover:opacity-80 transition-opacity"
    >
      UserHQ
    </Link>
  );
}
