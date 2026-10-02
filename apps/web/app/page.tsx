import Link from "next/link";
import { getMe } from "@/lib/api-server";

export default async function HomePage() {
  const { user } = await getMe();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            You&apos;re not signed in
          </h1>
          <p className="text-base text-muted-foreground">
            Sign in with Google or GitHub to continue.
          </p>
        </div>
        <div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const displayName = user.name?.trim();
  const heading = displayName
    ? `Signed in as ${displayName}`
    : "You're signed in";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight break-words">
          {heading}
        </h1>
        <p className="text-base text-muted-foreground">
          You&apos;ll stay signed in on this device for 14 days after your last visit.
        </p>
      </div>
    </div>
  );
}
