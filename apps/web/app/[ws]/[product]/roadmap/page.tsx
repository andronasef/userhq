import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicRoadmap } from "../../../../lib/api-server";
import { getRequestLocale, getDictionary } from "../../../../lib/i18n/server";
import { PublicRoadmapView } from "./public-roadmap-view";

interface PublicRoadmapPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicRoadmapPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const [result, locale] = await Promise.all([
    getPortalProduct(ws, product),
    getRequestLocale(),
  ]);
  if (!result.ok || !result.data.product.features.roadmap) return {};
  const dict = getDictionary(locale);
  return {
    title: `${dict.nav.roadmap} · ${result.data.product.name}`,
    description: dict.roadmap.subtitle,
  };
}

export default async function PublicRoadmapPage({
  params,
}: PublicRoadmapPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const productRes = await getPortalProduct(ws, product);
  if (!productRes.ok || !productRes.data.product.features.roadmap) notFound();
  const roadmapRes = await getPublicRoadmap(ws, product);
  if (!roadmapRes.ok && roadmapRes.status === 404) notFound();

  const { product: p, statuses } = productRes.data;
  const publicStatuses = statuses.filter((s) => Boolean(s.isPublicRoadmap));
  const items = roadmapRes.ok ? roadmapRes.data.items : [];

  return (
    <PublicRoadmapView
      ws={ws}
      product={product}
      productName={p.name}
      statuses={publicStatuses}
      items={items}
      boardEnabled={p.features.board}
    />
  );
}
