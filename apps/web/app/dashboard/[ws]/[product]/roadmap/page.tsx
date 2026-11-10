import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getStatuses,
  getMembers,
  getAdminRoadmap,
} from "../../../../../lib/api-server";
import { RoadmapView } from "./roadmap-view";
import { StatusesView } from "../statuses/statuses-view";
import { PageHeader } from "../../../../../components/page-header";
import { TabNav } from "../../../../../components/tab-nav";
import { getServerI18n } from "@/lib/i18n/server";

interface RoadmapPageProps {
  params: Promise<{ ws: string; product: string }>;
  searchParams: Promise<{
    view?: string;
    item?: string;
    linkPost?: string;
  }>;
}

export async function generateMetadata({
  params,
}: RoadmapPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const { t } = await getServerI18n();
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: `${t("roadmap.title")} · UserHQ` };
  }
  return {
    title: `${t("roadmap.title")} · ${result.data.name}`,
  };
}

export default async function RoadmapPage({
  params,
  searchParams,
}: RoadmapPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const { t } = await getServerI18n();
  const { view, item: initialItemId, linkPost: initialLinkPostNumber } =
    await searchParams;
  const [productRes, statusesRes, membersRes, roadmapRes] = await Promise.all([
    getProduct(ws, product),
    getStatuses(ws, product),
    getMembers(ws),
    getAdminRoadmap(ws, product),
  ]);

  if (!productRes.ok || !statusesRes.ok) {
    if (
      !productRes.ok &&
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  const productData = productRes.data;
  const statuses = statusesRes.data;
  const members = membersRes.ok ? membersRes.data : [];
  const items = roadmapRes.ok ? roadmapRes.data.items : [];

  const isStatusesView = view === "statuses";
  const tabs = [
    { label: t("roadmap.title"), href: `/dashboard/${ws}/${product}/roadmap` },
    {
      label: t("statuses.title"),
      href: `/dashboard/${ws}/${product}/roadmap?view=statuses`,
    },
  ];
  const activeHref = isStatusesView
    ? `/dashboard/${ws}/${product}/roadmap?view=statuses`
    : `/dashboard/${ws}/${product}/roadmap`;

  if (isStatusesView) {
    return (
      <div className="w-full max-w-5xl space-y-6">
        <PageHeader
          title={t("roadmap.title")}
          description={t("roadmap.description")}
        />
        <TabNav tabs={tabs} activeHref={activeHref} className="mb-6" />
        <StatusesView
          ws={ws}
          product={product}
          initial={statuses}
          showHeader={false}
        />
      </div>
    );
  }

  return (
    <RoadmapView
      ws={ws}
      product={productData}
      initialStatuses={statuses}
      initialMembers={members}
      initialItems={items}
      initialItemId={initialItemId}
      initialLinkPostNumber={
        initialLinkPostNumber ? Number(initialLinkPostNumber) : undefined
      }
      tabs={tabs}
      activeHref={activeHref}
    />
  );
}
