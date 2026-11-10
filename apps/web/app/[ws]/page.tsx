import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPortalDirectory } from "../../lib/api-server";
import { portalHref } from "../../lib/tenant";
import { PortalFrame } from "../../components/portal/portal-frame";
import { ProductCard } from "../../components/portal/product-card";
import { EmptyState } from "../../components/empty-state";
import { AppShell } from "../../components/app-shell";
import { StatePage } from "../../components/state-page";
import { Button } from "../../components/ui/button";
import { getRequestLocale, getDictionary } from "../../lib/i18n/server";

interface WorkspaceDirectoryPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceDirectoryPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getPortalDirectory(ws);
  if (!result.ok) {
    return { title: "UserHQ" };
  }
  return {
    title: result.data.workspace.name,
    description: `Products from ${result.data.workspace.name}.`,
  };
}

export default async function WorkspaceDirectoryPage({
  params,
}: WorkspaceDirectoryPageProps): Promise<React.JSX.Element> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);
  const result = await getPortalDirectory(ws);

  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      return (
        <AppShell>
          <StatePage
            title={dict.portal.unavailableTitle}
            body={dict.portal.unavailableBody}
            actions={
              <Button variant="outline" asChild>
                <Link href="/">{dict.portal.goToUserHQ}</Link>
              </Button>
            }
          />
        </AppShell>
      );
    }
    notFound();
  }

  const { workspace, directoryEnabled, products } = result.data;

  if (!directoryEnabled) {
    if (workspace.websiteUrl) {
      redirect(workspace.websiteUrl);
    }
    notFound();
  }

  if (products.length === 1) {
    redirect(portalHref(ws, products[0].slug));
  }

  return (
    <PortalFrame
      homeHref={portalHref(ws)}
      name={workspace.name}
      logoUrl={workspace.logoUrl}
      websiteUrl={workspace.websiteUrl}
      companyName={workspace.name}
    >
      <h1 className="text-2xl font-semibold mb-8 break-words text-foreground">
        {workspace.name}
      </h1>

      {products.length === 0 ? (
        <EmptyState
          title={dict.portal.noProductsYet}
          body={dict.portal.noProductsYetDesc.replace("{name}", workspace.name)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} ws={ws} product={product} />
          ))}
        </div>
      )}
    </PortalFrame>
  );
}
