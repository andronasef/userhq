import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicChangelogFeed } from "../../../../lib/api-server";
import { ChangelogFeed } from "../../../../components/changelog/changelog-feed";
import { PageHeader } from "../../../../components/page-header";

interface PublicChangelogPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicChangelogPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    return { title: "Changelog · UserHQ" };
  }
  return {
    title: `Changelog · ${result.data.product.name}`,
    description: `New features, improvements, and bug fixes for ${result.data.product.name}.`,
  };
}

export default async function PublicChangelogPage({
  params,
}: PublicChangelogPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, feedRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogFeed(ws, product),
  ]);

  if (!productRes.ok) {
    notFound();
  }

  const { product: p } = productRes.data;
  const entries = feedRes.ok ? feedRes.data.entries : [];
  const nextCursor = feedRes.ok ? feedRes.data.nextCursor : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <PageHeader
        title="Changelog"
        description={`New features, improvements, and bug fixes for ${p.name}.`}
      />
      <ChangelogFeed
        ws={ws}
        product={product}
        productName={p.name}
        productLogoUrl={p.logoUrl}
        entries={entries}
        nextCursor={nextCursor}
      />
    </div>
  );
}
