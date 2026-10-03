import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace, getMe } from "../../../lib/api-server";
import { isDevUploadEnabled } from "../../../lib/dev-flags";
import { UserMenu } from "../../../components/user-menu";
import { WorkspaceSwitcher } from "../../../components/dashboard/workspace-switcher";
import { DashboardSidebar } from "../../../components/dashboard/sidebar";
import { MobileNav } from "../../../components/dashboard/mobile-nav";
import { AppToaster } from "../../../components/ui/toaster";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ws: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { ws } = await params;
  const result = await getWorkspace(ws);

  if (!result.ok) {
    if (result.status === 404) {
      notFound();
    }
    throw new Error(`getWorkspace failed with status ${result.status}`);
  }

  const workspace = result.data;
  const me = await getMe();
  const devUploadEnabled = isDevUploadEnabled();

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        data-shell="dashboard"
        className="h-14 border-b border-border bg-background px-4 flex items-center gap-2 min-w-0"
      >
        <MobileNav>
          <DashboardSidebar ws={ws} products={[]} />
        </MobileNav>
        <Link href="/dashboard" className="text-base font-semibold text-foreground shrink-0">
          UserHQ
        </Link>
        <span className="text-muted-foreground shrink-0" aria-hidden="true">
          /
        </span>
        <WorkspaceSwitcher
          current={workspace}
          workspaces={me.workspaces}
          canCreate={me.canCreateWorkspace}
        />
        {me.user && (
          <div className="ml-auto shrink-0">
            <UserMenu
              user={me.user}
              devUploadEnabled={devUploadEnabled}
              hasWorkspaces={me.workspaces.length > 0}
              isPlatformOwner={me.isPlatformOwner}
            />
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-muted p-4 gap-6 overflow-y-auto">
          <DashboardSidebar ws={ws} products={[]} />
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="w-full max-w-3xl">
            {children}
          </div>
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
