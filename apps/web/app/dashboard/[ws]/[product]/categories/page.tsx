import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getCategories } from "../../../../../lib/api-server";
import { CategoriesView } from "./categories-view";

interface CategoriesPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: CategoriesPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Categories · UserHQ" };
  }
  return {
    title: `Categories · ${result.data.name}`,
  };
}

export default async function CategoriesPage({
  params,
}: CategoriesPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [productRes, categoriesRes] = await Promise.all([
    getProduct(ws, product),
    getCategories(ws, product),
  ]);

  if (!productRes.ok || !categoriesRes.ok) {
    if (
      !productRes.ok &&
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  const categories = categoriesRes.data;

  return (
    <CategoriesView
      ws={ws}
      product={product}
      initial={categories}
    />
  );
}
