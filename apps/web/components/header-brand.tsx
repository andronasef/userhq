"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { safeNext } from "../lib/safe-next";

export interface ActiveProjectInfo {
  name: string;
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
            const wsSlug = parts[1];
            const prodSlug = parts[2];
            const name =
              prodSlug.charAt(0).toUpperCase() +
              prodSlug.slice(1).replace(/-/g, " ");
            const wsName =
              wsSlug.charAt(0).toUpperCase() +
              wsSlug.slice(1).replace(/-/g, " ");
            setProject({
              name,
              wsName,
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
            const wsSlug = parts[0];
            const prodSlug = parts[1];
            const name =
              prodSlug.charAt(0).toUpperCase() +
              prodSlug.slice(1).replace(/-/g, " ");
            const wsName =
              wsSlug.charAt(0).toUpperCase() +
              wsSlug.slice(1).replace(/-/g, " ");
            setProject({
              name,
              wsName,
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

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Link
        href="/"
        className="text-base font-semibold text-foreground shrink-0 hover:opacity-80 transition-opacity"
      >
        UserHQ
      </Link>
      {project && (
        <>
          <span
            className="text-muted-foreground shrink-0 select-none text-sm"
            aria-hidden="true"
          >
            /
          </span>
          {project.wsName && project.wsName !== project.name && (
            <>
              <span className="text-base font-medium text-muted-foreground truncate hidden md:inline max-w-[150px]">
                {project.wsName}
              </span>
              <span
                className="text-muted-foreground shrink-0 select-none text-sm hidden md:inline"
                aria-hidden="true"
              >
                /
              </span>
            </>
          )}
          <Link
            href={project.href}
            className="text-base font-medium text-foreground hover:opacity-80 transition-opacity truncate max-w-[180px] sm:max-w-xs"
            title={`Back to ${project.name}`}
          >
            {project.name}
          </Link>
        </>
      )}
    </div>
  );
}
