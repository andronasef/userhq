import { PageHeader } from "../page-header";
import { TabNav } from "../tab-nav";

export function PlatformHeader({
  activeTab = "/platform",
}: {
  activeTab?: string;
}) {
  const tabs = [{ label: "Invites", href: "/platform" }];

  return (
    <div className="space-y-6 mb-8">
      <PageHeader
        title="Platform"
        description="Only you can see this page."
      />
      <TabNav tabs={tabs} activeHref={activeTab} />
    </div>
  );
}
