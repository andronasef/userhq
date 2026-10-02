import * as React from "react";
import Link from "next/link";
import { getMe } from "../lib/api-server";
import { isDevUploadEnabled } from "../lib/dev-flags";
import { UserMenu, SignInButton } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";

export async function Header(): Promise<React.JSX.Element> {
  const { user } = await getMe();
  const devUploadEnabled = isDevUploadEnabled();

  return (
    <header data-shell="app" className="h-14 border-b border-border bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 flex items-center justify-between h-full">
        <Link href="/" className="text-base font-semibold">
          UserHQ
        </Link>

        <div>
          {user ? (
            <>
              <UserMenu user={user} devUploadEnabled={devUploadEnabled} />
              <SessionKeepAlive />
            </>
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
