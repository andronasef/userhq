import * as React from "react";
import { redirect } from "next/navigation";
import { getMe, publicHost } from "../../../lib/api-server";
import { AppShell } from "../../../components/app-shell";
import { PageHeader } from "../../../components/page-header";
import { StatePage } from "../../../components/state-page";
import { CreateWorkspaceForm } from "./create-workspace-form";
import { getRequestLocale, getDictionary } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  return {
    title: `${dict.workspace.createWorkspace} · UserHQ`,
  };
}

export default async function NewWorkspacePage(): Promise<React.JSX.Element> {
  const me = await getMe();
  if (!me.user) {
    redirect("/login?next=%2Fdashboard%2Fnew");
  }

  const host = await publicHost();
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);

  return (
    <AppShell>
      <div className="max-w-3xl">
        {me.canCreateWorkspace ? (
          <>
            <PageHeader
              title={dict.workspace.createTitle}
              description={dict.workspace.createDescription}
            />
            <CreateWorkspaceForm host={host} />
          </>
        ) : (
          <StatePage
            title={dict.workspace.inviteOnlyTitle}
            body={dict.workspace.inviteOnlyBody}
          />
        )}
      </div>
    </AppShell>
  );
}
