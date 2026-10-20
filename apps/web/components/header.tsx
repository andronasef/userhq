import * as React from "react";
import { getMe } from "../lib/api-server";
import { isDevUploadEnabled } from "../lib/dev-flags";
import { UserMenu, SignInButton } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";
import { NotificationBell } from "./notifications/notification-bell";
import { HeaderBrand } from "./header-brand";

export async function Header(): Promise<React.JSX.Element> {
  const me = await getMe();
  const devUploadEnabled = isDevUploadEnabled();

  return (
    <header data-shell="app" className="h-14 border-b border-border bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 flex items-center justify-between h-full">
        <HeaderBrand />

        <div>
          {me.user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserMenu
                user={me.user}
                devUploadEnabled={devUploadEnabled}
                hasWorkspaces={me.workspaces.length > 0}
                isPlatformOwner={me.isPlatformOwner}
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
