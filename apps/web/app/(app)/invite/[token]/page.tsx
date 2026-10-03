import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getMe, getInvite } from "@/lib/api-server";
import { Button } from "@/components/ui/button";
import { SwitchAccountButton } from "./switch-account-button";

export const metadata: Metadata = {
  title: "Invite · UserHQ",
  referrer: "no-referrer",
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const me = await getMe();
  if (!me.user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const inviteResult = await getInvite(token);

  if (!inviteResult.ok) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This invite link isn&apos;t valid
          </h1>
          <p className="text-base text-muted-foreground">
            Check that you copied the whole link, or ask for a new one.
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inv = inviteResult.data;

  if (!inv.emailMatches) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This invite is for another email address
          </h1>
          <p className="text-base text-muted-foreground">
            This invite was created for {inv.maskedEmail}. You&apos;re signed in
            with a different account. Sign out and sign in with that email to
            accept it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SwitchAccountButton token={token} />
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.state === "expired") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This invite has expired
          </h1>
          <p className="text-base text-muted-foreground">
            Invite links work for 7 days. Ask the person who invited you for a
            new link.
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.state === "used") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This invite has already been used
          </h1>
          <p className="text-base text-muted-foreground">
            Each invite link works once. If you need access, ask the person who
            invited you for a new link.
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.state === "revoked") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This invite was canceled
          </h1>
          <p className="text-base text-muted-foreground">
            The person who created this link revoked it. Ask them for a new one.
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.workspaceSuspended) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            This workspace is unavailable
          </h1>
          <p className="text-base text-muted-foreground">
            You can&apos;t join {inv.workspaceName ?? "this workspace"} right
            now. Ask the person who invited you.
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.state === "pending" && inv.kind === "platform") {
    redirect("/dashboard/new");
  }

  // Workspace invites will be handled in 02-07
  redirect("/");
}
