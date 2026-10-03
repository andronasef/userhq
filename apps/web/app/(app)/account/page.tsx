import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount, getMe } from "@/lib/api-server";
import { PageHeader } from "@/components/page-header";
import { EmailPreferences } from "./email-preferences";

export const metadata: Metadata = {
  title: "Account · UserHQ",
};

export default async function AccountPage(): Promise<React.JSX.Element> {
  const me = await getMe();
  if (!me.user) {
    redirect("/login?next=/account");
  }

  const accountResult = await getAccount();
  if (!accountResult.ok) {
    redirect("/login?next=/account");
  }

  const account = accountResult.data;

  return (
    <div className="max-w-3xl">
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

        {/* Slot for 03-15 Danger zone */}
      </div>
    </div>
  );
}
