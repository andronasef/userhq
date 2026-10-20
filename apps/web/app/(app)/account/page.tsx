import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount, getMe } from "@/lib/api-server";
import { PageHeader } from "@/components/page-header";
import { safeNext } from "@/lib/safe-next";
import { EmailPreferences } from "./email-preferences";
import { DeleteAccount } from "./delete-account";
import { AccountBackButton } from "./back-button";

export const metadata: Metadata = {
  title: "Account · UserHQ",
};

export interface AccountPageProps {
  searchParams?: Promise<{ back?: string }>;
}

export default async function AccountPage({
  searchParams,
}: AccountPageProps): Promise<React.JSX.Element> {
  const me = await getMe();
  if (!me.user) {
    redirect("/login?next=/account");
  }

  const accountResult = await getAccount();
  if (!accountResult.ok) {
    redirect("/login?next=/account");
  }

  const account = accountResult.data;
  const params = searchParams ? await searchParams : undefined;
  const initialBack = params?.back ? safeNext(params.back, "") : undefined;

  return (
    <div className="max-w-3xl">
      <AccountBackButton initialBack={initialBack} />

      <PageHeader
        title="Account"
        description={`Signed in as ${account.name}.`}
      />

      <div className="mt-8 space-y-8">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Comment emails
          </h2>
          <EmailPreferences initialCommentEmails={account.commentEmails} />
        </section>

        <DeleteAccount
          isPlatformOwner={account.isPlatformOwner}
          ownedWorkspaces={account.ownedWorkspaces}
        />
      </div>
    </div>
  );
}
