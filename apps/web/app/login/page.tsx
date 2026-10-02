import { redirect } from "next/navigation";
import { getMe } from "../../lib/api-server.js";
import { safeNext } from "../../lib/safe-next.js";
import { LoginButtons } from "./login-buttons.js";

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
        ? params.error[0] ?? null
        : null;

  return (
    <div className="flex flex-1 justify-center items-start">
      <div className="mt-8 sm:mt-16 w-full max-w-sm bg-card border border-border rounded-lg p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold leading-tight">
            Sign in to UserHQ
          </h1>
          <p className="text-base text-muted-foreground">
            Use your Google or GitHub account to continue.
          </p>
        </div>

        <LoginButtons next={safe} rawErrorCode={rawError} />
      </div>
    </div>
  );
}
