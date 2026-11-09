import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api-server";
import { PageHeader } from "@/components/page-header";
import { ProductUsersManager } from "@/components/product-users/product-users-manager";

interface ProductUsersPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: ProductUsersPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Users · UserHQ" };
  }
  return {
    title: `Users · ${result.data.name}`,
  };
}

export default async function ProductUsersPage({
  params,
}: ProductUsersPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;

  const productRes = await getProduct(ws, product);

  if (!productRes.ok) {
    if (
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader
        title="Product Users Directory"
        description="Search active users, inspect attribution, and grant or revoke custom visual badges."
      />

      <ProductUsersManager ws={ws} product={product} />
    </div>
  );
}
