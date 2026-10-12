import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getAdminChangelogList,
  getAdminChangelogTags,
} from "../../../../../lib/api-server";
import { ChangelogStudio } from "../../../../../components/changelog/changelog-studio";

interface DashboardChangelogPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: DashboardChangelogPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Changelog · UserHQ" };
  }
  return {
    title: `Changelog · ${result.data.name}`,
  };
}

export default async function DashboardChangelogPage({
  params,
}: DashboardChangelogPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [productRes, changelogRes, tagsRes] = await Promise.all([
    getProduct(ws, product),
    getAdminChangelogList(ws, product),
    getAdminChangelogTags(ws, product),
  ]);

  if (!productRes.ok) {
    if (
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  const productData = productRes.data;
  const entries = changelogRes.ok ? changelogRes.data.entries : [];
  const tags = tagsRes.ok
    ? tagsRes.data
    : changelogRes.ok
      ? changelogRes.data.tags
      : [];

  return (
    <ChangelogStudio
      ws={ws}
      product={product}
      productName={productData.name}
      entries={entries}
      tags={tags}
    />
  );
}
