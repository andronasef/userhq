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

interface RoadmapPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: RoadmapPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Roadmap · UserHQ" };
  }
  return {
    title: `Roadmap · ${result.data.name}`,
  };
}

export default async function RoadmapPage({
  params,
}: RoadmapPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
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

  return (
    <RoadmapView
      ws={ws}
      product={productData}
      initialStatuses={statuses}
      initialMembers={members}
      initialItems={items}
    />
  );
}
