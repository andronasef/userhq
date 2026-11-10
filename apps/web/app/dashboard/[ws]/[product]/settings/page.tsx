import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getWorkspace,
  publicHost,
} from "../../../../../lib/api-server";
import { PageHeader } from "../../../../../components/page-header";
import { ProductGeneralForm } from "./product-general-form";
import { ProductFeaturesForm } from "./product-features-form";
import { ProductBrandingForm } from "./product-branding-form";
import { ProductLocalesForm } from "./product-locales-form";
import { ProductBadgesForm } from "./product-badges-form";
import { ProductDangerZone } from "./product-danger-zone";
import { getRequestLocale, getDictionary } from "../../../../../lib/i18n/server";

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
}: ProductSettingsPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);
  const [productRes, wsRes, host] = await Promise.all([
    getProduct(ws, product),
    getWorkspace(ws),
    publicHost(),
  ]);

  if (!productRes.ok || !wsRes.ok) {
    if (
      !wsRes.ok &&
      wsRes.status === 403 &&
      wsRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  const productData = productRes.data;
  const workspaceData = wsRes.data;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title={dict.settings.productSettingsTitle}
        description={dict.settings.productSettingsDesc}
      />

      <ProductGeneralForm
        ws={ws}
        product={productData}
        host={host}
        workspaceName={workspaceData.name}
      />

      <ProductFeaturesForm ws={ws} product={productData} host={host} />

      <div className="border-t border-border pt-8 mt-8">
        <ProductBrandingForm ws={ws} product={productData} />
      </div>

      <div className="border-t border-border pt-8 mt-8">
        <ProductLocalesForm ws={ws} product={productData} />
      </div>

      <div className="border-t border-border pt-8 mt-8">
        <ProductBadgesForm ws={ws} product={productData} />
      </div>

      <div className="border-t border-border pt-8 mt-8">
        <ProductDangerZone ws={ws} product={productData} />
      </div>
    </div>
  );
}
