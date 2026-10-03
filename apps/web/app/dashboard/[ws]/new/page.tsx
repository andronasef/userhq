import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, publicHost } from "../../../../lib/api-server";
import { PageHeader } from "../../../../components/page-header";
import { CreateProductForm } from "./create-product-form";

interface NewProductPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: NewProductPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "New product · UserHQ" };
  }
  return {
    title: `New product · ${result.data.name}`,
  };
}

export default async function NewProductPage({
  params,
}: NewProductPageProps): Promise<React.JSX.Element> {
  const { ws } = await params;
  const result = await getWorkspace(ws);

  if (!result.ok) {
    notFound();
  }

  const host = await publicHost();

  return (
    <div>
      <PageHeader
        title="New product"
        description="Each product has its own public feedback portal."
      />
      <CreateProductForm ws={ws} host={host} />
    </div>
  );
}
