import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount, getMe } from "@/lib/api-server";
import { PageHeader } from "@/components/page-header";
import { safeNext } from "@/lib/safe-next";
import { EmailPreferences } from "./email-preferences";
import { PushNotificationPreferences } from "./push-preferences";
import { DeleteAccount } from "./delete-account";
import { AccountBackButton } from "./back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguagePreference } from "./language-preference";
import { getRequestLocale, getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Account · UserHQ",
};

export interface AccountPageProps {
  searchParams?: Promise<{ back?: string }>;
}

export default async function AccountPage({
  searchParams,
}: AccountPageProps): Promise<React.JSX.Element> {
  const [me, locale] = await Promise.all([
    getMe(),
    getRequestLocale(),
  ]);
  if (!me.user) {
    redirect("/login?next=/account");
  }

  const dict = await getDictionary(locale);

  const accountResult = await getAccount();
  if (!accountResult.ok) {
    redirect("/login?next=/account");
  }

  const account = accountResult.data;
  const params = searchParams ? await searchParams : undefined;
  const initialBack = params?.back ? safeNext(params.back, "") : undefined;

  const signedInDescription = (
    dict.account?.signedInAs ?? "Signed in as {name}."
  ).replace("{name}", account.name);

  return (
    <div className="max-w-3xl">
      <AccountBackButton initialBack={initialBack} />

      <PageHeader
        title={dict.account?.pageTitle ?? "Account"}
        description={signedInDescription}
      />

      <div className="mt-8 space-y-8">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {dict.account?.appearanceTitle ?? "Appearance"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {dict.account?.appearanceDesc ??
              "Customize how UserHQ looks on your device. Choose between system settings, light mode, dark mode, or charcoal."}
          </p>
          <ThemeToggle variant="segmented" />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <LanguagePreference />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {dict.account?.commentEmailsTitle ?? "Comment emails"}
          </h2>
          <EmailPreferences initialCommentEmails={account.commentEmails} />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {dict.account?.pushTitle ?? "Browser push notifications"}
          </h2>
          <PushNotificationPreferences />
        </section>

        <DeleteAccount
          isPlatformOwner={account.isPlatformOwner}
          ownedWorkspaces={account.ownedWorkspaces}
        />
      </div>
    </div>
  );
}
