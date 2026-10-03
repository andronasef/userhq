import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getStatuses } from "../../../../../lib/api-server";
import { StatusesView } from "./statuses-view";

interface StatusesPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: StatusesPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Statuses · UserHQ" };
  }
  return {
    title: `Statuses · ${result.data.name}`,
  };
}

export default async function StatusesPage({
  params,
}: StatusesPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, statusesRes] = await Promise.all([
    getProduct(ws, product),
    getStatuses(ws, product),
  ]);

  if (!productRes.ok || !statusesRes.ok) {
    notFound();
  }

  const statuses = statusesRes.data;

  return (
    <StatusesView
      ws={ws}
      product={product}
      initial={statuses}
    />
  );
}
