import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerI18n } from "@/lib/i18n/server";
import { getMe, getPlatformInvites } from "@/lib/api-server";
import { PlatformHeader } from "@/components/platform/platform-header";
import { InviteCreator } from "@/components/invites/invite-creator";
import { InviteList } from "@/components/invites/invite-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("platform.metaTitle"),
  };
}

export default async function PlatformPage() {
  const me = await getMe();
  if (!me.isPlatformOwner) {
    notFound();
  }

  const invitesResult = await getPlatformInvites();
  const invites = invitesResult.ok ? invitesResult.data : [];

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 flex flex-col gap-8">
      <PlatformHeader activeTab="/platform" />

      <section className="flex flex-col gap-4">
        <InviteCreator kind="platform" endpoint="/api/v1/platform/invites" />
      </section>

      <section className="flex flex-col gap-4">
        <InviteList kind="platform" rows={invites} />
      </section>
    </div>
  );
}
