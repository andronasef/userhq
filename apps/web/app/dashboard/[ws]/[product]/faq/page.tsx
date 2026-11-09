import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getAdminFaqCategories } from "../../../../../lib/api-server";
import { HiddenModuleNotice } from "@/components/dashboard/hidden-module-notice";
import { PageHeader } from "../../../../../components/page-header";
import { FaqManager } from "../../../../../components/faq/faq-manager";

interface DashboardFaqPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: DashboardFaqPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "FAQ · Dashboard · UserHQ" };
  }
  return {
    title: `FAQ · ${result.data.name}`,
  };
}

export default async function DashboardFaqPage({
  params,
}: DashboardFaqPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [productRes, faqRes] = await Promise.all([
    getProduct(ws, product),
    getAdminFaqCategories(ws, product),
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

  const categories = faqRes.ok ? faqRes.data.categories : [];

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader
        title="Frequently Asked Questions"
        description="Manage self-serve knowledge base articles, categories, and question ordering."
      />
      {!productRes.data.features.faq && <HiddenModuleNotice ws={ws} product={product} module="faq" />}
      <FaqManager
        ws={ws}
        product={product}
        initialCategories={categories}
        productLocales={productRes.data.locales}
      />
    </div>
  );
}
