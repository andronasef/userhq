import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getAdminChangelogEntry,
  getAdminChangelogTags,
} from "../../../../../../lib/api-server";
import { ChangelogEditor } from "../../../../../../components/changelog/changelog-editor";

interface EditChangelogPageProps {
  params: Promise<{ ws: string; product: string; id: string }>;
}

export async function generateMetadata({
  params,
}: EditChangelogPageProps): Promise<Metadata> {
  const { ws, product, id } = await params;
  const [productRes, entryRes] = await Promise.all([
    getProduct(ws, product),
    getAdminChangelogEntry(ws, product, id),
  ]);

  if (!productRes.ok || !entryRes.ok) {
    return { title: "Edit Release Note · UserHQ" };
  }

  return {
    title: `Edit "${entryRes.data.title}" · ${productRes.data.name}`,
  };
}

export default async function EditChangelogPage({
  params,
}: EditChangelogPageProps): Promise<React.JSX.Element | null> {
  const { ws, product, id } = await params;
  const [productRes, entryRes, tagsRes] = await Promise.all([
    getProduct(ws, product),
    getAdminChangelogEntry(ws, product, id),
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

  if (!entryRes.ok) {
    notFound();
  }

  const p = productRes.data;
  const entry = entryRes.data;
  const tags = tagsRes.ok ? tagsRes.data : [];

  return (
    <ChangelogEditor
      ws={ws}
      product={product}
      productName={p.name}
      productLogoUrl={p.logoUrl}
      entry={entry}
      availableTags={tags}
    />
  );
}
