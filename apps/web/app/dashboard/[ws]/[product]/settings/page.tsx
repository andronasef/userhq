import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getWorkspace, publicHost } from "../../../../../lib/api-server";
import { PageHeader } from "../../../../../components/page-header";
import { ProductGeneralForm } from "./product-general-form";
import { ProductBrandingForm } from "./product-branding-form";
import { ProductDangerZone } from "./product-danger-zone";

interface ProductSettingsPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: ProductSettingsPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Product settings · UserHQ" };
  }
  return {
    title: `Product settings · ${result.data.name}`,
  };
}

export default async function ProductSettingsPage({
  params,
}: ProductSettingsPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, wsRes, host] = await Promise.all([
    getProduct(ws, product),
    getWorkspace(ws),
    publicHost(),
  ]);

  if (!productRes.ok || !wsRes.ok) {
    notFound();
  }

  const productData = productRes.data;
  const workspaceData = wsRes.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Product settings"
        description="Changes appear on the public portal right away."
      />

      <ProductGeneralForm
        ws={ws}
        product={productData}
        host={host}
        workspaceName={workspaceData.name}
      />

      <div className="border-t border-border pt-8 mt-8">
        <ProductBrandingForm ws={ws} product={productData} />
      </div>

      <div className="border-t border-border pt-8 mt-8">
        <ProductDangerZone ws={ws} product={productData} />
      </div>
    </div>
  );
}
