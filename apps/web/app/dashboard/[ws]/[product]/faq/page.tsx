import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getAdminFaqCategories } from "../../../../../lib/api-server";
import { HiddenModuleNotice } from "@/components/dashboard/hidden-module-notice";
import { PageHeader } from "../../../../../components/page-header";
import { FaqManager } from "../../../../../components/faq/faq-manager";
import { getServerI18n } from "@/lib/i18n/server";

interface DashboardFaqPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: DashboardFaqPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const { t } = await getServerI18n();
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: `${t("faq.title")} · UserHQ` };
  }
  return {
    title: `${t("faq.title")} · ${result.data.name}`,
  };
}

export default async function DashboardFaqPage({
  params,
}: DashboardFaqPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const { t } = await getServerI18n();
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
        title={t("faq.title")}
        description={t("faq.description")}
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
