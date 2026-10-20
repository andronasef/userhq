import { redirect } from "next/navigation";
import { getMe } from "../../../lib/api-server";
import { safeNext } from "../../../lib/safe-next";
import { LoginButtons } from "./login-buttons";
import { Alert } from "../../../components/ui/alert";
import {
  loginErrorCopy,
  isDisplayableErrorCode,
} from "../../../lib/login-errors";

export const metadata = {
  title: "Sign in · UserHQ",
};

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const safe = safeNext(params.next);

  const { user } = await getMe();
  if (user) {
    redirect(safe);
  }

  const rawError =
    typeof params.error === "string"
      ? params.error
      : Array.isArray(params.error)
        ? (params.error[0] ?? null)
        : null;

  const errorCopy = rawError ? loginErrorCopy(rawError) : null;
  const displayCode =
    rawError && isDisplayableErrorCode(rawError) ? rawError : null;

  return (
    <div className="flex flex-1 justify-center items-start">
      <div className="welcome-entry mt-6 sm:mt-12 w-full max-w-md bg-card border border-border rounded-lg p-6 sm:p-10 flex flex-col gap-7">
        <div className="flex flex-col gap-2 text-center">
          <img
            src="/brand/userhq-mark.svg"
            alt=""
            width={64}
            height={64}
            className="size-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold leading-tight">
            Sign in to UserHQ
          </h1>
          <p className="text-base text-muted-foreground">
            Use your Google or GitHub account to continue.
          </p>
        </div>

        {errorCopy && (
          <Alert variant="destructive" title={errorCopy.title}>
            <div>{errorCopy.body}</div>
            {displayCode && (
              <div className="text-muted-foreground mt-1 text-sm">
                {`Error code: ${displayCode}`}
              </div>
            )}
          </Alert>
        )}

        <LoginButtons next={safe} rawErrorCode={null} />
        <p className="text-center text-sm text-muted-foreground">
          Your feedback. Your next great idea.
        </p>
      </div>
    </div>
  );
}
