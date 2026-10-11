import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicRoadmap } from "../../../../lib/api-server";
import { PublicRoadmapView } from "./public-roadmap-view";

interface PublicRoadmapPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicRoadmapPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    return { title: "Roadmap · UserHQ" };
  }
  return {
    title: `Roadmap · ${result.data.product.name}`,
    description: `Follow public roadmap progress and upcoming features for ${result.data.product.name}.`,
  };
}

export default async function PublicRoadmapPage({
  params,
}: PublicRoadmapPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, roadmapRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicRoadmap(ws, product),
  ]);

  if (!productRes.ok) {
    notFound();
  }

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
    />
  );
}
