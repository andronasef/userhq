import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getWorkspace,
  getMembers,
  getTeamInvites,
  getMe,
} from "../../../../lib/api-server";
import { PageHeader } from "../../../../components/page-header";
import { MembersTable } from "../../../../components/team/members-table";
import { InviteCreator } from "../../../../components/invites/invite-creator";
import { InviteList } from "../../../../components/invites/invite-list";

interface TeamPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: TeamPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "Team · UserHQ" };
  }
  return {
    title: `Team · ${result.data.name}`,
  };
}

export default async function TeamPage({
  params,
}: TeamPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const [workspaceResult, membersResult, invitesResult, me] = await Promise.all([
    getWorkspace(ws),
    getMembers(ws),
    getTeamInvites(ws),
    getMe(),
  ]);

  if (!workspaceResult.ok || !membersResult.ok || !invitesResult.ok) {
    if (!workspaceResult.ok && workspaceResult.status === 403 && workspaceResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const workspace = workspaceResult.data;
  const members = membersResult.data;
  const invites = invitesResult.data;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Team"
        description={`Everyone here is an admin of ${workspace.name}.`}
      />

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <MembersTable
          ws={ws}
          workspaceName={workspace.name}
          rows={members}
          viewerId={me.user?.id ?? ""}
          viewerRole={workspace.role}
        />
      </section>

      <section className="border-t border-border pt-8 mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Invite a teammate
        </h2>
        <InviteCreator
          kind="workspace"
          endpoint={`/api/v1/workspaces/${ws}/invites`}
        />
      </section>

      <section className="border-t border-border pt-8 mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Invites</h2>
        <InviteList kind="workspace" rows={invites} workspaceSlug={ws} />
      </section>
    </div>
  );
}
