"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export interface SwitchAccountButtonProps {
  token: string;
}

export function SwitchAccountButton({ token }: SwitchAccountButtonProps) {
  const [isPending, setIsPending] = React.useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      await authClient.signOut();
    } catch {
      // Even if signOut errors, proceed to login page
    }
    const next = encodeURIComponent(`/invite/${token}`);
    window.location.assign(`/login?next=${next}`);
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          <span>Signing out…</span>
        </>
      ) : (
        <span>Sign out and switch account</span>
      )}
    </Button>
  );
}
