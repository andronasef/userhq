import * as React from "react";
import { redirect } from "next/navigation";
import { getMe, publicHost } from "../../../lib/api-server";
import { AppShell } from "../../../components/app-shell";
import { PageHeader } from "../../../components/page-header";
import { StatePage } from "../../../components/state-page";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata = {
  title: "Create workspace · UserHQ",
};

export default async function NewWorkspacePage(): Promise<React.JSX.Element> {
  const me = await getMe();
  if (!me.user) {
    redirect("/login?next=%2Fdashboard%2Fnew");
  }

  const host = await publicHost();

  return (
    <AppShell>
      <div className="max-w-3xl">
        {me.canCreateWorkspace ? (
          <>
            <PageHeader
              title="Create your workspace"
              description="You can change the name and logo later. The URL is permanent."
            />
            <CreateWorkspaceForm host={host} />
          </>
        ) : (
          <StatePage
            title="Workspace creation is invite-only"
            body="UserHQ is invite-only for now. If someone gave you an invite link, open it while signed in with the email it was created for."
          />
        )}
      </div>
    </AppShell>
  );
}
