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
import { getRequestLocale, getDictionary, formatMessage } from "../../../../../lib/i18n/server";

interface WorkspaceWebhooksPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceWebhooksPageProps): Promise<Metadata> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: dict.webhooks.metaTitle };
  }
  return {
    title: formatMessage(dict.webhooks.metaTitleWs, { name: result.data.name }),
  };
}

export default async function WorkspaceWebhooksPage({
  params,
}: WorkspaceWebhooksPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
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
        title={dict.settings.title}
        description={dict.webhooks.settingsDescription}
      />
      <TabNav
        tabs={[
          { label: dict.settings.tabGeneral, href: `/dashboard/${ws}/settings` },
          { label: dict.settings.tabApiKeys, href: `/dashboard/${ws}/settings/api-keys` },
          { label: dict.settings.tabWebhooks, href: `/dashboard/${ws}/settings/webhooks` },
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
