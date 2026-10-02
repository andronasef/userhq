"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ImageUp, LogOut, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button.js";
import { Avatar } from "./ui/avatar.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu.js";
import { authClient } from "../lib/auth-client.js";

export interface UserMenuProps {
  user: {
    name: string;
    image: string | null;
  };
  devUploadEnabled: boolean;
}

export function UserMenu({
  user,
  devUploadEnabled,
}: UserMenuProps): React.JSX.Element {
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
