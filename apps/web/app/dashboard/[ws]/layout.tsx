import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace, getMe, getProducts } from "../../../lib/api-server";
import { isDevUploadEnabled } from "../../../lib/dev-flags";
import { getDictionary, getRequestLocale, formatMessage } from "../../../lib/i18n/server";
import { UserMenu } from "../../../components/user-menu";
import { NotificationBell } from "../../../components/notifications/notification-bell";
import { ThemeToggle } from "../../../components/theme-toggle";
import { WorkspaceSwitcher } from "../../../components/dashboard/workspace-switcher";
import { DashboardSidebar } from "../../../components/dashboard/sidebar";
import { MobileNav } from "../../../components/dashboard/mobile-nav";
import { AppToaster } from "../../../components/ui/toaster";
import { AppShell } from "../../../components/app-shell";
import { StatePage } from "../../../components/state-page";
import { Button } from "../../../components/ui/button";
import { UserHQBrand } from "../../../components/userhq-brand";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ws: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { ws } = await params;
  const [result, locale] = await Promise.all([
    getWorkspace(ws),
    getRequestLocale(),
  ]);
  const dict = getDictionary(locale);

  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      const me = await getMe();
      const wsInfo = me.workspaces.find((w) => w.slug === ws);
      const name = wsInfo?.name ?? ws;
      return (
        <AppShell>
          <StatePage
            title={formatMessage(dict.workspace?.workspaceUnavailable ?? "{name} is unavailable", { name })}
            body={dict.workspace?.suspendedDesc ?? "This workspace has been suspended by the UserHQ team. Your data is kept. Contact the UserHQ team to restore access."}
            actions={
              <>
                <Button variant="outline" asChild>
                  <Link href="/">{dict.common?.goToHome ?? "Go to home"}</Link>
                </Button>
                {me.workspaces.length > 1 && (
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">{dict.workspace?.switchWorkspace ?? "Switch workspace"}</Link>
                  </Button>
                )}
              </>
            }
          />
        </AppShell>
      );
    }
    if (result.status === 404) {
      notFound();
    }
    throw new Error(`getWorkspace failed with status ${result.status}`);
  }

  const workspace = result.data;
  const me = await getMe();
  const devUploadEnabled = isDevUploadEnabled();
  const isWorkspaceOwner =
    me.isPlatformOwner || me.workspaces.some((w) => w.slug === ws && w.role === "owner");
  const productsResult = await getProducts(ws);
  const products = productsResult.ok ? productsResult.data : [];

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        data-shell="dashboard"
        className="h-16 border-b border-border bg-card px-4 flex items-center gap-3 min-w-0"
      >
        <MobileNav>
          <DashboardSidebar ws={ws} products={products} isWorkspaceOwner={isWorkspaceOwner} />
        </MobileNav>
        <Link
          href="/dashboard"
          className="text-base font-semibold text-foreground shrink-0 hidden sm:inline"
        >
          <UserHQBrand />
        </Link>
        <span
          className="text-muted-foreground shrink-0 hidden sm:inline"
          aria-hidden="true"
        >
          /
        </span>
        <WorkspaceSwitcher
          current={workspace}
          workspaces={me.workspaces}
          canCreate={me.canCreateWorkspace}
        />
        {me.user && (
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu
              user={me.user}
              devUploadEnabled={devUploadEnabled}
              hasWorkspaces={me.workspaces.length > 0}
              isPlatformOwner={me.isPlatformOwner}
              isWorkspaceOwner={isWorkspaceOwner}
            />
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card p-4 pt-6 gap-6 overflow-y-auto">
          <DashboardSidebar ws={ws} products={products} isWorkspaceOwner={isWorkspaceOwner} />
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {children}
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
