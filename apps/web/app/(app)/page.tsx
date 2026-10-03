import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "../../lib/api-server";
import { isDevUploadEnabled } from "../../lib/dev-flags";
import { Button } from "../../components/ui/button";

export default async function HomePage(): Promise<React.JSX.Element> {
  const me = await getMe();

  if (!me.user) {
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

  if (me.workspaces.length === 1) {
    redirect(`/dashboard/${me.workspaces[0].slug}`);
  }

  if (me.workspaces.length >= 2) {
    redirect("/dashboard");
  }

  // 0 workspaces:
  return (
    <div className="flex flex-col gap-6">
      {me.canCreateWorkspace ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight">
              Set up your workspace
            </h1>
            <p className="text-base text-muted-foreground">
              A workspace holds your products, your team, and the portals your customers visit.
            </p>
          </div>
          <div>
            <Button variant="default" size="lg" asChild>
              <Link href="/dashboard/new">Create workspace</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            Workspace creation is invite-only
          </h1>
          <p className="text-base text-muted-foreground">
            UserHQ is invite-only for now. If someone gave you an invite link, open it while signed in with the email it was created for.
          </p>
        </div>
      )}

      {isDevUploadEnabled() && (
        <div className="pt-4 border-t border-border">
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
