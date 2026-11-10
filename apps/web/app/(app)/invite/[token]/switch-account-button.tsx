"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n/context";

export interface SwitchAccountButtonProps {
  token: string;
}

export function SwitchAccountButton({ token }: SwitchAccountButtonProps) {
  const { t } = useI18n();
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
          <span>{t("invite.signingOut")}</span>
        </>
      ) : (
        <span>{t("invite.signOutSwitch")}</span>
      )}
    </Button>
  );
}
