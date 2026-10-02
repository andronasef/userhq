import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace, getMe } from "../../../lib/api-server";
import { isDevUploadEnabled } from "../../../lib/dev-flags";
import { UserMenu } from "../../../components/user-menu";

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
        className="h-14 border-b border-border bg-background px-4 flex items-center gap-2"
      >
        <Link href="/dashboard" className="text-base font-semibold text-foreground">
          UserHQ
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <span className="text-sm font-semibold truncate text-foreground">
          {workspace.name}
        </span>
        {me.user && (
          <div className="ml-auto">
            <UserMenu user={me.user} devUploadEnabled={devUploadEnabled} />
          </div>
        )}
      </header>
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          {children}
        </div>
      </main>
    </div>
  );
}
