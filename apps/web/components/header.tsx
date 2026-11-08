import * as React from "react";
import Link from "next/link";
import { getMe } from "../lib/api-server";
import { isDevUploadEnabled } from "../lib/dev-flags";
import { UserMenu, SignInButton } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";
import { NotificationBell } from "./notifications/notification-bell";
import { HeaderBrand } from "./header-brand";
import { ThemeToggle } from "./theme-toggle";

export async function Header(): Promise<React.JSX.Element> {
  const me = await getMe();
  const devUploadEnabled = isDevUploadEnabled();
  const isWorkspaceOwner =
    me.isPlatformOwner || me.workspaces.some((w) => w.role === "owner");

  return (
    <header data-shell="app" className="h-16 border-b border-border bg-card">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 flex items-center justify-between h-full">
        <div className="flex items-center gap-6">
          <HeaderBrand />
          {isWorkspaceOwner && (
            <nav className="hidden sm:flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <Link
                href="/guide"
                className="hover:text-foreground transition-colors"
              >
                Guide
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {me.user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserMenu
                user={me.user}
                devUploadEnabled={devUploadEnabled}
                hasWorkspaces={me.workspaces.length > 0}
                isPlatformOwner={me.isPlatformOwner}
                isWorkspaceOwner={isWorkspaceOwner}
              />
              <SessionKeepAlive />
            </div>
          ) : (
            <React.Suspense fallback={null}>
              <SignInButton />
            </React.Suspense>
          )}
        </div>
      </div>
    </header>
  );
}
