import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace } from "../../../lib/api-server";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";

interface DashboardPageProps {
  params: Promise<{ ws: string }>;
}

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { ws } = await params;
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: "Dashboard · UserHQ" };
  }
  return {
    title: `Products · ${result.data.name}`,
  };
}

export default async function DashboardPage({
  params,
}: DashboardPageProps): Promise<React.JSX.Element> {
  const { ws } = await params;
  const result = await getWorkspace(ws);

  if (!result.ok) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Each product gets its own public portal."
      />
      <EmptyState
        title="No products yet"
        body="Create a product to give your customers a public portal for feedback."
      />
    </div>
  );
}
