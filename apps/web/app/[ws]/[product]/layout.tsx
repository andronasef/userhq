import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalProduct, getMe, publicOrigin } from "../../../lib/api-server";
import { portalHref } from "../../../lib/tenant";
import { accentTokens } from "../../../lib/accent";
import { isDevUploadEnabled } from "../../../lib/dev-flags";
import { PortalFrame } from "../../../components/portal/portal-frame";
import { AppShell } from "../../../components/app-shell";
import { StatePage } from "../../../components/state-page";
import { Button } from "../../../components/ui/button";
import { UserMenu, SignInButton } from "../../../components/user-menu";
import { SessionKeepAlive } from "../../../components/session-keepalive";
import { PortalTabs } from "../../../components/portal/portal-tabs";
import { NotificationBell } from "../../../components/notifications/notification-bell";
import { AppToaster } from "../../../components/ui/toaster";
import { ProjectContextTracker } from "../../../components/portal/project-context-tracker";

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PortalLayoutProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      return {
        title: "Workspace unavailable · UserHQ",
      };
    }
    return {
      title: "Not Found",
    };
  }

  const { product: p, workspace } = result.data;
  const origin = publicOrigin();
  const title = `${p.name} · ${workspace.name}`;
  const description =
    p.tagline ??
    `Share feedback, vote on ideas, and follow what's coming next for ${p.name}.`;

  const meta: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: workspace.name,
      images: p.logoUrl
        ? [
            {
              url: p.logoUrl.startsWith("http")
                ? p.logoUrl
                : `${origin}${p.logoUrl}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: p.logoUrl
        ? [
            p.logoUrl.startsWith("http")
              ? p.logoUrl
              : `${origin}${p.logoUrl}`,
          ]
        : undefined,
    },
  };

  if (p.logoUrl) {
    meta.icons = {
      icon: p.logoUrl,
    };
  }

  return meta;
}

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [result, me] = await Promise.all([
    getPortalProduct(ws, product),
    getMe(),
  ]);

  const devUploadEnabled = isDevUploadEnabled();

  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      return (
        <AppShell>
          <StatePage
            title="This page is unavailable"
            body="This portal isn't available right now. Check back later."
            actions={
              <Button variant="outline" asChild>
                <Link href="/">Go to UserHQ</Link>
              </Button>
            }
          />
        </AppShell>
      );
    }
    notFound();
  }

  const { workspace, product: p } = result.data;
  const tokens = accentTokens(p.accentColor);
  const accentStyle: React.CSSProperties = {
    "--primary": tokens.primary,
    "--primary-foreground": tokens.primaryForeground,
    "--primary-text": tokens.primaryText,
    "--entity-accent": tokens.primary,
  } as React.CSSProperties;

  const right = me.user ? (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <UserMenu
        user={me.user}
        devUploadEnabled={devUploadEnabled}
        hasWorkspaces={me.workspaces.length > 0}
        isPlatformOwner={me.isPlatformOwner}
      />
      <SessionKeepAlive />
    </div>
  ) : (
    <React.Suspense fallback={null}>
      <SignInButton />
    </React.Suspense>
  );

  return (
    <PortalFrame
      homeHref={portalHref(ws, product)}
      name={p.name}
      logoUrl={p.logoUrl}
      tagline={p.tagline}
      websiteUrl={p.websiteUrl}
      companyName={workspace.name}
      accentStyle={accentStyle}
      right={right}
      tabs={<PortalTabs ws={ws} product={product} hasUser={Boolean(me.user)} />}
    >
      <ProjectContextTracker
        name={p.name}
        wsName={workspace.name}
        href={portalHref(ws, product)}
      />
      <AppToaster />
      {children}
    </PortalFrame>
  );
}
