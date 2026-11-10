"use client";

import { useI18n } from "@/lib/i18n/context";
import { PageHeader } from "../page-header";
import { TabNav } from "../tab-nav";

export function PlatformHeader({
  activeTab = "/platform",
}: {
  activeTab?: string;
}) {
  const { t } = useI18n();

  const tabs = [
    { label: t("platform.tabInvites"), href: "/platform" },
    { label: t("platform.tabWorkspaces"), href: "/platform/workspaces" },
    { label: t("platform.tabUsers"), href: "/platform/users" },
  ];

  return (
    <div className="space-y-6 mb-8">
      <PageHeader
        title={t("platform.title")}
        description={t("platform.description")}
      />
      <TabNav tabs={tabs} activeHref={activeTab} />
    </div>
  );
}
