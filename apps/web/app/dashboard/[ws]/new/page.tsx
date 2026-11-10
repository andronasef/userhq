import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, publicHost } from "../../../../lib/api-server";
import { PageHeader } from "../../../../components/page-header";
import { CreateProductForm } from "./create-product-form";
import { getRequestLocale, getDictionary, formatMessage } from "../../../../lib/i18n/server";

interface NewProductPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: NewProductPageProps): Promise<Metadata> {
  const { ws } = await params;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: dict.product.newProductMeta };
  }
  return {
    title: formatMessage(dict.product.newProductWsMeta, { name: result.data.name }),
  };
}

export default async function NewProductPage({
  params,
}: NewProductPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const result = await getWorkspace(ws);

  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const host = await publicHost();
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHeader
        title={dict.product.newProductTitle}
        description={dict.product.newProductDesc}
      />
      <CreateProductForm ws={ws} host={host} />
    </div>
  );
}
