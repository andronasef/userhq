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
import { getRequestLocale, getDictionary, formatMessage } from "../../../../../lib/i18n/server";

interface WorkspaceApiKeysPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceApiKeysPageProps): Promise<Metadata> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: dict.apiKeys.metaTitle };
  }
  return {
    title: formatMessage(dict.apiKeys.metaTitleWs, { name: result.data.name }),
  };
}

export default async function WorkspaceApiKeysPage({
  params,
}: WorkspaceApiKeysPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
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
        title={dict.settings.title}
        description={dict.apiKeys.settingsDescription}
      />
      <TabNav
        tabs={[
          { label: dict.settings.tabGeneral, href: `/dashboard/${ws}/settings` },
          { label: dict.settings.tabApiKeys, href: `/dashboard/${ws}/settings/api-keys` },
          { label: dict.settings.tabWebhooks, href: `/dashboard/${ws}/settings/webhooks` },
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
