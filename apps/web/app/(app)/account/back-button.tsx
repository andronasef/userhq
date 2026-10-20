"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/safe-next";

export interface AccountBackButtonProps {
  initialBack?: string | null;
}

export function AccountBackButton({
  initialBack,
}: AccountBackButtonProps): React.JSX.Element {
  const router = useRouter();
  const [backHref, setBackHref] = React.useState<string | null>(() => {
    if (initialBack) {
      const sanitized = safeNext(initialBack, "");
      if (sanitized && sanitized !== "/account" && sanitized !== "/login") {
        return sanitized;
      }
    }
    return null;
  });

  React.useEffect(() => {
    if (backHref) {
      try {
        sessionStorage.setItem("userhq_last_return", backHref);
      } catch {
        // Ignore storage errors
      }
      return;
    }

    try {
      const cached = sessionStorage.getItem("userhq_last_return");
      if (cached) {
        const sanitized = safeNext(cached, "");
        if (sanitized && sanitized !== "/account" && sanitized !== "/login") {
          setBackHref(sanitized);
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }

    if (typeof document !== "undefined" && document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (refUrl.origin === window.location.origin) {
          const path = refUrl.pathname + refUrl.search;
          const sanitized = safeNext(path, "");
          if (sanitized && sanitized !== "/account" && sanitized !== "/login") {
            setBackHref(sanitized);
            return;
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }, [backHref]);

  const label = React.useMemo(() => {
    if (!backHref) return "Back";
    if (backHref.startsWith("/dashboard")) return "Back to dashboard";
    const parts = backHref.split("/").filter(Boolean);
    if (
      parts.length >= 2 &&
      !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(
        parts[0]
      )
    ) {
      return "Back to portal";
    }
    return "Back";
  }, [backHref]);

  const handleBackClick = (e: React.MouseEvent) => {
    if (!backHref) {
      e.preventDefault();
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        asChild={Boolean(backHref)}
        onClick={!backHref ? handleBackClick : undefined}
        className="-ml-3 w-fit text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
      >
        {backHref ? (
          <Link href={backHref}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ) : (
          <button type="button">
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        )}
      </Button>
    </div>
  );
}
