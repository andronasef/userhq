import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicFaqTree } from "../../../../lib/api-server";
import { FaqPortal } from "../../../../components/faq/faq-portal";
import { PageHeader } from "../../../../components/page-header";

interface PublicFaqPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicFaqPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    return { title: "FAQ · UserHQ" };
  }
  return {
    title: `Frequently Asked Questions · ${result.data.product.name}`,
    description: `Find quick answers to common questions about ${result.data.product.name}.`,
  };
}

export default async function PublicFaqPage({
  params,
}: PublicFaqPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, faqRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicFaqTree(ws, product),
  ]);

  if (!productRes.ok) {
    notFound();
  }

  const { product: p } = productRes.data;
  const categories = faqRes.ok ? faqRes.data.categories : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <PageHeader
        title="Frequently Asked Questions"
        description={`Find quick answers to common questions about ${p.name}.`}
      />
      <FaqPortal ws={ws} product={product} categories={categories} />
    </div>
  );
}
