import * as React from "react";
import Link from "next/link";
import { getMe } from "../../lib/api-server";
import { isDevUploadEnabled } from "../../lib/dev-flags";
import { Avatar } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";

export default async function HomePage(): Promise<React.JSX.Element> {
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
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
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
      <div className="flex items-center gap-4 flex-wrap">
        <Avatar size="lg" src={user.image} name={user.name} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight break-words">
            {heading}
          </h1>
          <p className="text-base text-muted-foreground">
            You&apos;ll stay signed in on this device for 14 days after your last visit.
          </p>
        </div>
      </div>

      {isDevUploadEnabled() && (
        <div>
          <Link
            href="/dev/upload"
            className="text-foreground underline text-sm"
          >
            Test image uploads →
          </Link>
        </div>
      )}
    </div>
  );
}
