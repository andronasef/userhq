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
      return { title: "Unavailable · UserHQ" };
    }
    return {};
  }

  const { workspace, product: p } = result.data;
  const title =
    p.name.toLowerCase() === workspace.name.toLowerCase()
      ? p.name
      : `${p.name} · ${workspace.name}`;

  const description =
    p.tagline ?? `Share feedback and follow updates for ${p.name}.`;

  const origin = await publicOrigin();
  const absoluteLogoUrl = p.logoUrl ? `${origin}${p.logoUrl}` : null;

  return {
    title,
    description,
    openGraph: {
      title: p.name,
      description,
      siteName: workspace.name,
      images: absoluteLogoUrl ? [absoluteLogoUrl] : undefined,
    },
    icons: absoluteLogoUrl
      ? {
          icon: [{ url: absoluteLogoUrl, type: "image/webp" }],
        }
      : undefined,
  };
}

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
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
    <>
      <UserMenu
        user={me.user}
        devUploadEnabled={devUploadEnabled}
        hasWorkspaces={me.workspaces.length > 0}
        isPlatformOwner={me.isPlatformOwner}
      />
      <SessionKeepAlive />
    </>
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
    >
      {children}
    </PortalFrame>
  );
}
