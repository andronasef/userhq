import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getWorkspace, getProducts } from "../../../lib/api-server";
import { portalHref } from "../../../lib/tenant";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";
import { Button } from "../../../components/ui/button";
import { EntityLogo } from "../../../components/entity-logo";

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
}: DashboardPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const wsResult = await getWorkspace(ws);

  if (!wsResult.ok) {
    if (wsResult.status === 403 && wsResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const productsResult = await getProducts(ws);
  const products = productsResult.ok ? productsResult.data : [];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Each product gets its own public portal."
        action={
          products.length > 0 ? (
            <Button asChild>
              <Link href={`/dashboard/${ws}/new`}>Create product</Link>
            </Button>
          ) : undefined
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="Create a product to give your customers a public portal for feedback."
          action={
            <Button asChild>
              <Link href={`/dashboard/${ws}/new`}>Create product</Link>
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {products.map((product) => (
            <div
              key={product.slug}
              className="flex items-center justify-between p-4 gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <EntityLogo
                  src={product.logoUrl}
                  name={product.name}
                  size={40}
                  style={
                    {
                      "--entity-accent": product.accentColor,
                    } as React.CSSProperties
                  }
                />
                <div className="flex flex-col min-w-0">
                  <Link
                    href={`/dashboard/${ws}/${product.slug}/statuses`}
                    className="text-sm font-semibold text-foreground hover:underline truncate"
                  >
                    {product.name}
                  </Link>
                  <span className="text-sm font-mono text-muted-foreground truncate">
                    /{ws}/{product.slug}
                  </span>
                </div>
              </div>

              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <a
                  href={portalHref(ws, product.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span>View portal</span>
                </a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
