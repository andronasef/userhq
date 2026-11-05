import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getWorkspace,
  getWorkspaceApiKeys,
  getProducts,
} from "../../../../../lib/api-server";
import { PageHeader } from "../../../../../components/page-header";
import { TabNav } from "../../../../../components/tab-nav";
import { WorkspaceApiKeysManager } from "../../../../../components/api-keys/api-keys-manager";

interface WorkspaceApiKeysPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceApiKeysPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "API Keys · UserHQ" };
  }
  return {
    title: `API Keys · ${result.data.name}`,
  };
}

export default async function WorkspaceApiKeysPage({
  params,
}: WorkspaceApiKeysPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const [wsResult, keysResult, productsResult] = await Promise.all([
    getWorkspace(ws),
    getWorkspaceApiKeys(ws),
    getProducts(ws),
  ]);

  if (!wsResult.ok) {
    if (wsResult.status === 403 && wsResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const initialKeys = keysResult.ok ? keysResult.data.keys : [];
  const products = productsResult.ok ? productsResult.data : [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Workspace settings"
        description="Manage your workspace API keys and automation tokens."
      />
      <TabNav
        tabs={[
          { label: "General", href: `/dashboard/${ws}/settings` },
          { label: "API Keys", href: `/dashboard/${ws}/settings/api-keys` },
          { label: "Webhooks", href: `/dashboard/${ws}/settings/webhooks` },
        ]}
        activeHref={`/dashboard/${ws}/settings/api-keys`}
        className="mb-8"
      />
      <WorkspaceApiKeysManager
        ws={ws}
        initialKeys={initialKeys}
        products={products}
      />
    </div>
  );
}
