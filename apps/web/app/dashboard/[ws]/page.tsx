import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";
import {
  getWorkspace,
  getProducts,
  getWorkspaceRequests,
  getWorkspaceComments,
  getCategories,
  getPushFollowedProducts,
} from "../../../lib/api-server";
import { portalHref } from "../../../lib/tenant";
import { EmptyState } from "../../../components/empty-state";
import { Button } from "../../../components/ui/button";
import { EntityLogo } from "../../../components/entity-logo";
import {
  WorkspaceDashboardTabs,
  type DashboardTab,
} from "../../../components/workspace-dashboard/workspace-dashboard-tabs";
import { WorkspaceRequestsView } from "../../../components/workspace-dashboard/workspace-requests-view";
import { ProductFollowToggle } from "../../../components/workspace-dashboard/product-follow-toggle";
import { WorkspaceCommentsView } from "../../../components/workspace-dashboard/workspace-comments-view";
import { getRequestLocale, getDictionary } from "../../../lib/i18n/server";

interface DashboardPageProps {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{
    tab?: string;
    product?: string;
    statusType?: string;
    categoryId?: string;
    createdFrom?: string;
    createdTo?: string;
    search?: string;
    sort?: string;
    cursor?: string;
    attention?: string;
  }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: DashboardPageProps) {
  const { ws } = await params;
  const search = await searchParams;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const result = await getWorkspace(ws);
  if (!result.ok) {
    return { title: `Dashboard · UserHQ` };
  }
  const tabName =
    search.tab === "products"
      ? dict.workspace.tabProducts
      : search.tab === "comments"
        ? dict.workspace.tabComments
        : dict.workspace.tabRequests;
  return {
    title: `${tabName} · ${result.data.name}`,
  };
}

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps): Promise<React.JSX.Element | null> {
  const { ws } = await params;
  const search = await searchParams;
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);

  const currentTab =
    search.tab === "products" || search.tab === "comments"
      ? search.tab
      : "requests";

  const [wsResult, productsResult, initialCommentsResult, followedResult] = await Promise.all([
    getWorkspace(ws),
    getProducts(ws),
    getWorkspaceComments(ws, { limit: 1 }),
    // Only the Products tab renders follow toggles; a failed read just shows every toggle off.
    currentTab === "products"
      ? getPushFollowedProducts().catch(() => null)
      : Promise.resolve(null),
  ]);
  const followedProductIds = new Set(
    followedResult?.ok ? followedResult.data.map((f) => f.productId) : [],
  );

  if (!wsResult.ok) {
    if (wsResult.status === 403 && wsResult.code === "workspace_suspended") {
      return null;
    }
    notFound();
  }

  const products = productsResult.ok ? productsResult.data : [];
  const needsAttentionCount = initialCommentsResult.ok
    ? initialCommentsResult.data.needsAttentionCount
    : 0;

  // Fetch tab-specific data
  let requestsData = null;
  let requestCategories: { id: string; name: string }[] = [];
  if (currentTab === "requests") {
    const [res, categoriesRes] = await Promise.all([
      getWorkspaceRequests(ws, {
        product: search.product,
        statusType: search.statusType as any,
        categoryId: search.categoryId,
        createdFrom: search.createdFrom,
        createdTo: search.createdTo,
        search: search.search,
        sort: search.sort as any,
        cursor: search.cursor,
      }),
      search.product ? getCategories(ws, search.product) : Promise.resolve(null),
    ]);
    if (res.ok) requestsData = res.data;
    if (categoriesRes?.ok) requestCategories = categoriesRes.data;
  }

  let commentsData = null;
  if (currentTab === "comments") {
    const res = await getWorkspaceComments(ws, {
      product: search.product,
      attention: search.attention as any,
      cursor: search.cursor,
    });
    if (res.ok) commentsData = res.data;
  }

  const tabs: DashboardTab[] = [
    {
      id: "requests",
      label: dict.workspace.tabRequests,
      href: `/dashboard/${encodeURIComponent(ws)}?tab=requests`,
    },
    {
      id: "comments",
      label: dict.workspace.tabComments,
      badge: needsAttentionCount,
      href: `/dashboard/${encodeURIComponent(ws)}?tab=comments`,
    },
    {
      id: "products",
      label: dict.workspace.tabProducts,
      count: products.length,
      href: `/dashboard/${encodeURIComponent(ws)}?tab=products`,
    },
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Workspace Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {wsResult.data.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dict.workspace.dashboardDesc}
          </p>
        </div>

        {currentTab === "products" && products.length > 0 && (
          <Button asChild className="gap-1.5 shrink-0 self-start sm:self-auto">
            <Link href={`/dashboard/${encodeURIComponent(ws)}/new`}>
              <Plus className="size-4" />
              <span>{dict.workspace.createProduct}</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Workspace Dashboard Tabs */}
      <WorkspaceDashboardTabs tabs={tabs} activeTab={currentTab} />

      {/* Tab 1: Requests (All Boards) */}
      {currentTab === "requests" && (
        <WorkspaceRequestsView
          ws={ws}
          products={products}
          initialRequests={requestsData?.items ?? []}
          initialNextCursor={requestsData?.nextCursor ?? null}
          initialTotalCount={requestsData?.totalCount ?? 0}
          currentProduct={search.product}
          currentStatusType={search.statusType}
          currentSort={search.sort}
          currentSearch={search.search}
          categories={requestCategories}
          currentCategoryId={search.categoryId}
          currentCreatedFrom={search.createdFrom}
          currentCreatedTo={search.createdTo}
        />
      )}

      {/* Tab 2: Comments */}
      {currentTab === "comments" && (
        <WorkspaceCommentsView
          ws={ws}
          products={products}
          initialComments={commentsData?.items ?? []}
          initialNextCursor={commentsData?.nextCursor ?? null}
          initialNeedsAttentionCount={
            commentsData?.needsAttentionCount ?? needsAttentionCount
          }
          currentProduct={search.product}
          currentAttention={
            (search.attention as "needs_attention" | "handled" | "all") ||
            "needs_attention"
          }
        />
      )}

      {/* Tab 3: Products */}
      {currentTab === "products" && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <EmptyState
              title={dict.workspace.noProductsTitle}
              body={dict.workspace.noProductsBody}
              action={
                <Button asChild>
                  <Link href={`/dashboard/${encodeURIComponent(ws)}/new`}>
                    {dict.workspace.createProduct}
                  </Link>
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
                        href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product.slug)}/board`}
                        className="text-sm font-semibold text-foreground hover:underline truncate"
                      >
                        {product.name}
                      </Link>
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        /{ws}/{product.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ProductFollowToggle
                      ws={ws}
                      productSlug={product.slug}
                      productName={product.name}
                      initialFollowing={product.id !== undefined && followedProductIds.has(product.id)}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product.slug)}/board`}
                      >
                        {dict.workspace.manageProduct}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={portalHref(ws, product.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{dict.workspace.viewPortal}</span>
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
