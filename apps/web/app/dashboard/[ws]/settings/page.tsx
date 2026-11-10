import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, publicHost } from "../../../../lib/api-server";
import { PageHeader } from "../../../../components/page-header";
import { TabNav } from "../../../../components/tab-nav";
import { WorkspaceSettingsForms } from "./workspace-settings-forms";
import { getRequestLocale, getDictionary, formatMessage } from "../../../../lib/i18n/server";

interface WorkspaceSettingsPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: WorkspaceSettingsPageProps): Promise<Metadata> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: dict.settings.metaTitle };
  }
  return {
    title: formatMessage(dict.settings.metaTitleWs, { name: result.data.name }),
  };
}

export default async function WorkspaceSettingsPage({
  params,
}: WorkspaceSettingsPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const [wsResult, host] = await Promise.all([
    getWorkspace(ws),
    publicHost(),
  ]);

  if (!wsResult.ok) {
    if (wsResult.status === 403 && wsResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={dict.settings.title}
        description={dict.settings.description}
      />
      <TabNav
        tabs={[
          { label: dict.settings.tabGeneral, href: `/dashboard/${ws}/settings` },
          { label: dict.settings.tabApiKeys, href: `/dashboard/${ws}/settings/api-keys` },
          { label: dict.settings.tabWebhooks, href: `/dashboard/${ws}/settings/webhooks` },
        ]}
        activeHref={`/dashboard/${ws}/settings`}
        className="mb-8"
      />
      <WorkspaceSettingsForms
        ws={ws}
        workspace={wsResult.data}
        host={host}
      />
    </div>
  );
}
