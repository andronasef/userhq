import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getWorkspace,
  getWorkspaceWebhooks,
  getProducts,
} from "../../../../../lib/api-server";
import { PageHeader } from "../../../../../components/page-header";
import { TabNav } from "../../../../../components/tab-nav";
import { WorkspaceWebhooksManager } from "../../../../../components/webhooks/webhooks-manager";

interface WorkspaceWebhooksPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceWebhooksPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "Webhooks · UserHQ" };
  }
  return {
    title: `Webhooks · ${result.data.name}`,
  };
}

export default async function WorkspaceWebhooksPage({
  params,
}: WorkspaceWebhooksPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const [wsResult, webhooksResult, productsResult] = await Promise.all([
    getWorkspace(ws),
    getWorkspaceWebhooks(ws),
    getProducts(ws),
  ]);

  if (!wsResult.ok) {
    if (wsResult.status === 403 && wsResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const initialSubscriptions = webhooksResult.ok
    ? webhooksResult.data.subscriptions
    : [];
  const products = productsResult.ok ? productsResult.data : [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Workspace settings"
        description="Configure outbound webhooks, signing secrets, and delivery retry policies."
      />
      <TabNav
        tabs={[
          { label: "General", href: `/dashboard/${ws}/settings` },
          { label: "API Keys", href: `/dashboard/${ws}/settings/api-keys` },
          { label: "Webhooks", href: `/dashboard/${ws}/settings/webhooks` },
        ]}
        activeHref={`/dashboard/${ws}/settings/webhooks`}
        className="mb-8"
      />
      <WorkspaceWebhooksManager
        ws={ws}
        initialSubscriptions={initialSubscriptions}
        products={products}
      />
    </div>
  );
}
