import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicChangelogEntry } from "../../../../../lib/api-server";
import { ChangelogArticle } from "../../../../../components/changelog/changelog-article";

interface ChangelogArticlePageProps {
  params: Promise<{ ws: string; product: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: ChangelogArticlePageProps): Promise<Metadata> {
  const { ws, product, slug } = await params;
  const [productRes, entryRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogEntry(ws, product, slug),
  ]);

  if (!productRes.ok || !entryRes.ok) {
    return { title: "Changelog · UserHQ" };
  }

  const entry = entryRes.data;
  const prod = productRes.data.product;

  return {
    title: `${entry.title} · ${prod.name} Changelog`,
    description:
      entry.summary ?? `Read release notes for ${entry.title} on ${prod.name}.`,
    openGraph: {
      title: entry.title,
      description:
        entry.summary ?? `Read release notes for ${entry.title} on ${prod.name}.`,
      type: "article",
      publishedTime: entry.publishedAt,
    },
  };
}

export default async function ChangelogArticlePage({
  params,
}: ChangelogArticlePageProps): Promise<React.JSX.Element> {
  const { ws, product, slug } = await params;
  const [productRes, entryRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogEntry(ws, product, slug),
  ]);

  if (!productRes.ok || !entryRes.ok) {
    notFound();
  }

  return (
    <ChangelogArticle
      ws={ws}
      product={product}
      productName={productRes.data.product.name}
      productLogoUrl={productRes.data.product.logoUrl}
      entry={entryRes.data}
    />
  );
}
