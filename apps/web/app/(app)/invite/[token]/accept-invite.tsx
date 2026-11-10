"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  AcceptInviteResultSchema,
  type AcceptInviteResult,
} from "@userhq/types";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";

export interface AcceptInviteProps {
  token: string;
  workspaceName: string;
  workspaceSlug: string;
}

export function AcceptInvite({
  token,
  workspaceName,
  workspaceSlug,
}: AcceptInviteProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useI18n();
  const [hasError, setHasError] = React.useState(false);
  const attemptedRef = React.useRef(false);

  const runAccept = React.useCallback(async () => {
    setHasError(false);
    try {
      const res = await apiFetch<AcceptInviteResult>(
        `/api/v1/invites/${token}/accept`,
        {
          method: "POST",
          schema: AcceptInviteResultSchema,
        }
      );
      window.location.assign(`/dashboard/${res.workspaceSlug || workspaceSlug}`);
    } catch (err: any) {
      if (err?.status >= 400 && err?.status < 500) {
        router.refresh();
      } else {
        setHasError(true);
      }
    }
  }, [token, workspaceSlug, router]);

  React.useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    runAccept();
  }, [runAccept]);

  if (hasError) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold leading-tight text-foreground">
          {t("invite.couldNotJoin", { workspace: workspaceName })}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("invite.errorDesc")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={runAccept}>{t("invite.retryJoining")}</Button>
          <Button variant="outline" asChild>
            <Link href="/">{t("invite.goToHome")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      <h1 className="text-base font-semibold text-foreground" role="status">
        {t("invite.joiningWorkspace", { workspace: workspaceName })}
      </h1>
    </div>
  );
}
