import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, publicHost } from "../../../../lib/api-server";
import { PageHeader } from "../../../../components/page-header";
import { WorkspaceSettingsForms } from "./workspace-settings-forms";

interface WorkspaceSettingsPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceSettingsPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "Workspace settings · UserHQ" };
  }
  return {
    title: `Workspace settings · ${result.data.name}`,
  };
}

export default async function WorkspaceSettingsPage({
  params,
}: WorkspaceSettingsPageProps): Promise<React.JSX.Element> {
  const { ws } = await params;
  const [wsResult, host] = await Promise.all([
    getWorkspace(ws),
    publicHost(),
  ]);

  if (!wsResult.ok) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Workspace settings"
        description="Manage your workspace name, branding, and public directory."
      />
      <WorkspaceSettingsForms
        ws={ws}
        workspace={wsResult.data}
        host={host}
      />
    </div>
  );
}
