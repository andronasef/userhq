import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalProduct, getActivity, getMe } from "../../../../lib/api-server";
import { ActivityView } from "./activity-view";

interface ActivityPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: ActivityPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    return { title: "My activity · UserHQ" };
  }
  return {
    title: `My activity · ${result.data.product.name}`,
    description: `Track updates and status changes on feedback you follow for ${result.data.product.name}.`,
  };
}

export default async function ActivityPage({
  params,
}: ActivityPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const me = await getMe();
  if (!me.user) {
    redirect(`/login?next=/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/activity`);
  }

  const [productRes, activityRes] = await Promise.all([
    getPortalProduct(ws, product),
    getActivity(ws, product),
  ]);

  if (!productRes.ok) {
    notFound();
  }

  const activities = activityRes.ok ? activityRes.data.activities : [];

  return (
    <ActivityView
      ws={ws}
      product={product}
      productName={productRes.data.product.name}
      activities={activities}
    />
  );
}
