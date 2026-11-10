import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicFaqTree } from "../../../../lib/api-server";
import { FaqPortal } from "../../../../components/faq/faq-portal";
import { PageHeader } from "../../../../components/page-header";
import { getRequestLocale, getDictionary } from "../../../../lib/i18n/server";

interface PublicFaqPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicFaqPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok || !result.data.product.features.faq) return {};
  return {
    title: `Frequently Asked Questions · ${result.data.product.name}`,
    description: `Find quick answers to common questions about ${result.data.product.name}.`,
  };
}

export default async function PublicFaqPage({
  params,
}: PublicFaqPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, locale] = await Promise.all([
    getPortalProduct(ws, product),
    getRequestLocale(),
  ]);
  if (!productRes.ok || !productRes.data.product.features.faq) notFound();
  const dict = getDictionary(locale);
  const faqRes = await getPublicFaqTree(ws, product);
  if (!faqRes.ok && faqRes.status === 404) notFound();

  const { product: p } = productRes.data;
  const categories = faqRes.ok ? faqRes.data.categories : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <PageHeader
        title={dict.faq.title}
        description={dict.faq.subtitle.replace("{name}", p.name)}
      />
      <FaqPortal boardEnabled={p.features.board} ws={ws} product={product} categories={categories} />
    </div>
  );
}
