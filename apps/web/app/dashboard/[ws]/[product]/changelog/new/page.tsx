import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getAdminChangelogTags,
} from "../../../../../../lib/api-server";
import { ChangelogEditor } from "../../../../../../components/changelog/changelog-editor";

interface NewChangelogPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: NewChangelogPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "New Release Note · UserHQ" };
  }
  return {
    title: `New Release Note · ${result.data.name}`,
  };
}

export default async function NewChangelogPage({
  params,
}: NewChangelogPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [productRes, tagsRes] = await Promise.all([
    getProduct(ws, product),
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

  const p = productRes.data;
  const tags = tagsRes.ok ? tagsRes.data : [];

  return (
    <ChangelogEditor
      ws={ws}
      product={product}
      productName={p.name}
      productLogoUrl={p.logoUrl}
      availableTags={tags}
    />
  );
}
