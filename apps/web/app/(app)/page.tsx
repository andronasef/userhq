import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "../../lib/api-server";
import { isDevUploadEnabled } from "../../lib/dev-flags";
import { Button } from "../../components/ui/button";
import { ArrowRight, MessagesSquare, Kanban, Megaphone } from "lucide-react";

export default async function HomePage(): Promise<React.JSX.Element> {
  const me = await getMe();

  if (!me.user) {
    return (
      <div className="welcome-entry mx-auto max-w-3xl py-8 sm:py-16">
        <div className="mb-8 flex items-center gap-3" aria-hidden="true">
          <img
            src="/brand/userhq-mark.svg"
            alt=""
            width={64}
            height={64}
            className="size-16"
          />
          <span className="h-2 w-2 rounded-full bg-[var(--brand-coral)]" />
        </div>
        <h1 className="max-w-xl text-4xl sm:text-5xl font-semibold leading-[1.12]">
          Good products start
          <br className="hidden sm:block" /> with listening.
        </h1>
        <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-muted-foreground">
          Give customer feedback a home. See what matters, plan what&apos;s
          next, and share what you ship.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          <Button size="lg" asChild>
            <Link href="/login">
              Sign in to UserHQ{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Continue with Google or GitHub.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6 text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MessagesSquare
              className="size-4 text-[var(--brand-indigo)]"
              aria-hidden="true"
            />
            Feedback
          </span>
          <span className="inline-flex items-center gap-2">
            <Kanban
              className="size-4 text-[var(--brand-indigo)]"
              aria-hidden="true"
            />
            Roadmap
          </span>
          <span className="inline-flex items-center gap-2">
            <Megaphone
              className="size-4 text-[var(--brand-indigo)]"
              aria-hidden="true"
            />
            Changelog
          </span>
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
              A workspace holds your products, your team, and the portals your
              customers visit.
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
            UserHQ is invite-only for now. If someone gave you an invite link,
            open it while signed in with the email it was created for.
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
