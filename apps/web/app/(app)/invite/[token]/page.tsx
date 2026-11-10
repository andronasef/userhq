import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getMe, getInvite } from "@/lib/api-server";
import { Button } from "@/components/ui/button";
import { SwitchAccountButton } from "./switch-account-button";
import { AcceptInvite } from "./accept-invite";
import { getRequestLocale, getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Invite · UserHQ",
  referrer: "no-referrer",
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const [{ token }, locale] = await Promise.all([
    params,
    getRequestLocale(),
  ]);
  const dict = await getDictionary(locale);

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
            {dict.invite?.invalidLinkTitle ?? "This invite link isn't valid"}
          </h1>
          <p className="text-base text-muted-foreground">
            {dict.invite?.invalidLinkDesc ??
              "Check that you copied the whole link, or ask for a new one."}
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inv = inviteResult.data;

  if (!inv.emailMatches) {
    const desc = (
      dict.invite?.wrongEmailDesc ??
      "This invite was created for {email}. You're signed in with a different account. Sign out and sign in with that email to accept it."
    ).replace("{email}", inv.maskedEmail ?? "");

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            {dict.invite?.wrongEmailTitle ??
              "This invite is for another email address"}
          </h1>
          <p className="text-base text-muted-foreground">{desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SwitchAccountButton token={token} />
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
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
            {dict.invite?.expiredTitle ?? "This invite has expired"}
          </h1>
          <p className="text-base text-muted-foreground">
            {dict.invite?.expiredDesc ??
              "Invite links work for 7 days. Ask the person who invited you for a new link."}
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
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
            {dict.invite?.usedTitle ?? "This invite has already been used"}
          </h1>
          <p className="text-base text-muted-foreground">
            {dict.invite?.usedDesc ??
              "Each invite link works once. If you need access, ask the person who invited you for a new link."}
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
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
            {dict.invite?.revokedTitle ?? "This invite was canceled"}
          </h1>
          <p className="text-base text-muted-foreground">
            {dict.invite?.revokedDesc ??
              "The person who created this link revoked it. Ask them for a new one."}
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.workspaceSuspended) {
    const desc = (
      dict.invite?.unavailableDesc ??
      "You can't join {workspace} right now. Ask the person who invited you."
    ).replace(
      "{workspace}",
      inv.workspaceName ?? (dict.invite?.thisWorkspace ?? "this workspace")
    );

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            {dict.invite?.unavailableTitle ??
              "This workspace is unavailable"}
          </h1>
          <p className="text-base text-muted-foreground">{desc}</p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.invite?.goToHome ?? "Go to home"}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (inv.state === "pending" && inv.kind === "platform") {
    redirect("/dashboard/new");
  }

  if (inv.alreadyMember && inv.workspaceSlug) {
    redirect(`/dashboard/${inv.workspaceSlug}`);
  }

  if (inv.state === "pending" && inv.kind === "workspace" && inv.workspaceSlug) {
    return (
      <AcceptInvite
        token={token}
        workspaceName={
          inv.workspaceName ?? (dict.invite?.theWorkspace ?? "the workspace")
        }
        workspaceSlug={inv.workspaceSlug}
      />
    );
  }

  redirect("/");
}
