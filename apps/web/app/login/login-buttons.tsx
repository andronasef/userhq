"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { Alert } from "../../components/ui/alert.js";
import {
  GoogleIcon,
  GitHubIcon,
} from "../../components/icons/provider-icons.js";
import { authClient } from "../../lib/auth-client.js";
import {
  loginErrorCopy,
  isDisplayableErrorCode,
  type LoginErrorCopy,
} from "../../lib/login-errors.js";

export interface LoginButtonsProps {
  next: string;
  rawErrorCode: string | null;
}

export function LoginButtons({
  next,
  rawErrorCode,
}: LoginButtonsProps): React.JSX.Element {
  const [pendingProvider, setPendingProvider] = React.useState<
    "google" | "github" | null
  >(null);

  const [activeError, setActiveError] = React.useState<LoginErrorCopy | null>(
    () => (rawErrorCode ? loginErrorCopy(rawErrorCode) : null)
  );

  const [displayedErrorCode, setDisplayedErrorCode] = React.useState<
    string | null
  >(() =>
    rawErrorCode && isDisplayableErrorCode(rawErrorCode) ? rawErrorCode : null
  );

  const handleSignIn = async (provider: "google" | "github") => {
    setActiveError(null);
    setDisplayedErrorCode(null);
    setPendingProvider(provider);

    const errorCallbackURL =
      next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";

    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: next,
        errorCallbackURL,
      });

      if (res?.error) {
        setPendingProvider(null);
        setActiveError(loginErrorCopy("request_failed"));
      }
    } catch {
      setPendingProvider(null);
      setActiveError(loginErrorCopy("request_failed"));
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {activeError && (
        <Alert variant="destructive" title={activeError.title}>
          <div>{activeError.body}</div>
          {displayedErrorCode && (
            <div className="text-muted-foreground mt-1 text-sm">
              {`Error code: ${displayedErrorCode}`}
            </div>
          )}
        </Alert>
      )}

      <div className="flex flex-col gap-2 w-full">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={Boolean(pendingProvider)}
          onClick={() => handleSignIn("google")}
        >
          {pendingProvider === "google" ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin shrink-0"
                aria-hidden="true"
              />
              <span>Redirecting to Google…</span>
            </>
          ) : (
            <>
              <GoogleIcon className="size-4 shrink-0" />
              <span>Continue with Google</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={Boolean(pendingProvider)}
          onClick={() => handleSignIn("github")}
        >
          {pendingProvider === "github" ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin shrink-0"
                aria-hidden="true"
              />
              <span>Redirecting to GitHub…</span>
            </>
          ) : (
            <>
              <GitHubIcon className="size-4 shrink-0" />
              <span>Continue with GitHub</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
