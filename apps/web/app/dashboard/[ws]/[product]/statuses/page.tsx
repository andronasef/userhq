import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getStatuses } from "../../../../../lib/api-server";
import { StatusesView } from "./statuses-view";
import { PageHeader } from "../../../../../components/page-header";
import { TabNav } from "../../../../../components/tab-nav";
import { getServerI18n } from "@/lib/i18n/server";

interface StatusesPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: StatusesPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const [{ t }, result] = await Promise.all([
    getServerI18n(),
    getProduct(ws, product),
  ]);
  if (!result.ok) {
    return { title: t("statuses.metaTitle") };
  }
  return {
    title: t("statuses.metaTitleWs", { name: result.data.name }),
  };
}

export default async function StatusesPage({
  params,
}: StatusesPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [{ t }, productRes, statusesRes] = await Promise.all([
    getServerI18n(),
    getProduct(ws, product),
    getStatuses(ws, product),
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

  const statuses = statusesRes.data;
  const tabs = [
    { label: t("roadmap.title"), href: `/dashboard/${ws}/${product}/roadmap` },
    {
      label: t("statuses.title"),
      href: `/dashboard/${ws}/${product}/roadmap?view=statuses`,
    },
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      <PageHeader
        title={t("roadmap.title")}
        description={t("roadmap.description")}
      />
      <TabNav
        tabs={tabs}
        activeHref={`/dashboard/${ws}/${product}/roadmap?view=statuses`}
        className="mb-6"
      />
      <StatusesView
        ws={ws}
        product={product}
        initial={statuses}
        showHeader={false}
      />
    </div>
  );
}
