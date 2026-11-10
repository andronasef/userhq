import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getAdminChangelogTags,
} from "../../../../../../lib/api-server";
import { getServerI18n } from "@/lib/i18n/server";
import { ChangelogEditor } from "../../../../../../components/changelog/changelog-editor";

interface NewChangelogPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: NewChangelogPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const { t } = await getServerI18n();
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: `${t("changelog.newEntry")} · UserHQ` };
  }
  return {
    title: `${t("changelog.newEntry")} · ${result.data.name}`,
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
      changelogEnabled={productRes.data.features.changelog}
      productName={p.name}
      productLogoUrl={p.logoUrl}
      productLocales={p.locales}
      availableTags={tags}
    />
  );
}
