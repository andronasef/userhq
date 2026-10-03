import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "../../lib/api-server";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { EntityLogo } from "../../components/entity-logo";
import { Button } from "../../components/ui/button";

export const metadata: Metadata = {
  title: "Your workspaces · UserHQ",
};

export default async function DashboardPickerPage(): Promise<React.JSX.Element> {
  const me = await getMe();

  if (!me.user) {
    redirect("/login?next=%2Fdashboard");
  }

  if (me.workspaces.length === 0) {
    redirect("/");
  }

  if (me.workspaces.length === 1) {
    redirect(`/dashboard/${me.workspaces[0].slug}`);
  }

  const sortedWorkspaces = [...me.workspaces].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <AppShell>
      <PageHeader
        title="Choose a workspace"
        action={
          me.canCreateWorkspace ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard/new">Create workspace</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-lg border border-border divide-y divide-border">
        {sortedWorkspaces.map((ws) => {
          const roleLabel = ws.role === "admin" ? "Admin" : "Owner";

          return (
            <Link
              key={ws.slug}
              href={`/dashboard/${ws.slug}`}
              className="flex items-center gap-4 p-4 hover:bg-muted transition-colors"
            >
              <EntityLogo src={ws.logoUrl} name={ws.name} size={40} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-base font-semibold text-foreground truncate">
                  {ws.name}
                </span>
                <span className="text-sm font-mono text-muted-foreground truncate">
                  /{ws.slug}
                </span>
              </div>
              <span className="inline-flex items-center h-6 px-2 rounded-full text-xs font-semibold bg-muted text-foreground shrink-0">
                {roleLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
