"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ImageUp,
  LogOut,
  LoaderCircle,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { authClient } from "../lib/auth-client";

export interface UserMenuProps {
  user: {
    name: string;
    image: string | null;
  };
  devUploadEnabled: boolean;
  hasWorkspaces?: boolean;
  isPlatformOwner?: boolean;
}

export function UserMenu({
  user,
  devUploadEnabled,
  hasWorkspaces = false,
  isPlatformOwner = false,
}: UserMenuProps): React.JSX.Element {
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const pathname = usePathname();
  const isAccountPage = pathname === "/account";
  const [accountReturnHref, setAccountReturnHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pathname && pathname !== "/account" && pathname !== "/login") {
      try {
        sessionStorage.setItem("userhq_last_return", pathname);
      } catch {
        // Ignore storage errors
      }
    } else if (isAccountPage) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const back = sp.get("back") || sessionStorage.getItem("userhq_last_return");
        if (back && back.startsWith("/") && back !== "/account" && back !== "/login") {
          setAccountReturnHref(back);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [pathname, isAccountPage]);

  const portalProductMatch = pathname ? pathname.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/) : null;
  const isPortalProduct =
    portalProductMatch &&
    !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(portalProductMatch[1]);
  const activityHref = isPortalProduct
    ? `/${portalProductMatch[1]}/${portalProductMatch[2]}/activity`
    : null;

  const returnPortalMatch =
    isAccountPage && accountReturnHref
      ? accountReturnHref.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/)
      : null;
  const isReturnPortal =
    returnPortalMatch &&
    !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(
      returnPortalMatch[1]
    );

  const effectiveActivityHref =
    activityHref ||
    (isReturnPortal
      ? `/${returnPortalMatch[1]}/${returnPortalMatch[2]}/activity`
      : null);

  const accountHref =
    pathname && !isAccountPage && pathname !== "/login"
      ? `/account?back=${encodeURIComponent(pathname)}`
      : "/account";

  const handleSignOut = async () => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const res = await authClient.signOut();
      if (res?.error) {
        setIsPending(false);
        setErrorMessage("Couldn't sign out. Check your connection and try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setIsPending(false);
      setErrorMessage("Couldn't sign out. Check your connection and try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open account menu"
        >
          <Avatar size="sm" src={user.image} name={user.name} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel className="truncate max-w-48">
          {user.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(hasWorkspaces || isPlatformOwner) && (
          <>
            {hasWorkspaces && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center gap-2 w-full">
                  <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
            )}
            {isPlatformOwner && (
              <DropdownMenuItem asChild>
                <Link href="/platform" className="flex items-center gap-2 w-full">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                  <span>Platform console</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {devUploadEnabled && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dev/upload" className="flex items-center gap-2 w-full">
                <ImageUp className="size-4 shrink-0" aria-hidden="true" />
                <span>Upload test</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {isAccountPage && accountReturnHref && (
          <DropdownMenuItem asChild>
            <Link href={accountReturnHref} className="flex items-center gap-2 w-full">
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {accountReturnHref.startsWith("/dashboard")
                  ? "Back to dashboard"
                  : isReturnPortal
                  ? "Back to portal"
                  : "Back"}
              </span>
            </Link>
          </DropdownMenuItem>
        )}

        {effectiveActivityHref && (
          <DropdownMenuItem asChild>
            <Link href={effectiveActivityHref} className="flex items-center gap-2 w-full">
              <Activity className="size-4 shrink-0" aria-hidden="true" />
              <span>My activity</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={accountHref} className="flex items-center gap-2 w-full">
            <UserCog className="size-4 shrink-0" aria-hidden="true" />
            <span>Account settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          {isPending ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin shrink-0"
                aria-hidden="true"
              />
              <span>Signing out…</span>
            </>
          ) : (
            <>
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>Sign out</span>
            </>
          )}
        </DropdownMenuItem>

        {errorMessage && (
          <div
            role="alert"
            className="text-sm px-2 py-2 text-destructive font-normal"
          >
            {errorMessage}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignInButton(): React.JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/login") {
    return null;
  }

  const search = searchParams?.toString();
  const currentPath = search ? `${pathname}?${search}` : pathname;
  const href = `/login?next=${encodeURIComponent(currentPath)}`;

  return (
    <Button variant="outline" asChild>
      <Link href={href}>Sign in</Link>
    </Button>
  );
}
