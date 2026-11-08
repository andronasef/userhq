"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  ChevronUp,
  Search,
  X,
  ExternalLink,
  Mail,
  MapPin,
} from "lucide-react";
import type {
  WorkspaceRequestItem,
  WorkspaceRequestsQuery,
  ProductSummary,
  Category,
} from "@userhq/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { EntityLogo } from "@/components/entity-logo";
import { EmptyState } from "@/components/empty-state";
import { fetchWorkspaceRequests } from "@/lib/api-client";
import { postHref, dashboardPostHref } from "@/lib/tenant";

export interface WorkspaceRequestsViewProps {
  ws: string;
  products: ProductSummary[];
  initialRequests: WorkspaceRequestItem[];
  initialNextCursor: string | null;
  initialTotalCount: number;
  currentProduct?: string;
  currentStatusType?: string;
  currentSort?: string;
  currentSearch?: string;
  categories?: Pick<Category, "id" | "name">[];
  currentCategoryId?: string;
  currentCreatedFrom?: string;
  currentCreatedTo?: string;
}

export interface RequestFilters {
  product?: string;
  statusType?: string;
  categoryId?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  search?: string;
}

/** One place that turns the active filters into an API query, so load more never drops a filter. */
export function buildRequestsQuery(
  filters: RequestFilters,
  cursor?: string | null
): WorkspaceRequestsQuery {
  const query: WorkspaceRequestsQuery = {};
  if (filters.product) query.product = filters.product;
  if (filters.statusType) query.statusType = filters.statusType as WorkspaceRequestsQuery["statusType"];
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.createdFrom) query.createdFrom = filters.createdFrom;
  if (filters.createdTo) query.createdTo = filters.createdTo;
  if (filters.sort) query.sort = filters.sort as WorkspaceRequestsQuery["sort"];
  if (filters.search) query.search = filters.search;
  if (cursor) query.cursor = cursor;
  return query;
}

export function LoadMoreFooter({
  hasNext,
  loading,
  error,
  onLoadMore,
  onRetry,
}: {
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}): React.JSX.Element | null {
  if (!hasNext && !error) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs">
            Try again
          </Button>
        </div>
      )}
      {hasNext && (
        <Button
          variant="outline"
          onClick={onLoadMore}
          disabled={loading}
          className="w-full max-w-xs"
        >
          {loading ? "Loading more..." : "Load more requests"}
        </Button>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function WorkspaceRequestsView({
  ws,
  products,
  initialRequests,
  initialNextCursor,
  initialTotalCount,
  currentProduct = "",
  currentStatusType = "",
  currentSort = "top",
  currentSearch = "",
  categories = [],
  currentCategoryId = "",
  currentCreatedFrom = "",
  currentCreatedTo = "",
}: WorkspaceRequestsViewProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const boardEnabled = new Set(
    products.filter((p) => p.features?.board).map((p) => p.slug)
  );
  const [items, setItems] = React.useState<WorkspaceRequestItem[]>(initialRequests);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [totalCount, setTotalCount] = React.useState<number>(initialTotalCount);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState(currentSearch);

  React.useEffect(() => {
    setItems(initialRequests);
    setNextCursor(initialNextCursor);
    setTotalCount(initialTotalCount);
    setLoadError(null);
    setSearchInput(currentSearch);
  }, [initialRequests, initialNextCursor, initialTotalCount, currentSearch]);

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "requests");
    for (const [k, v] of Object.entries(updates)) {
      if (!v) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    // Reset cursor on filter change
    params.delete("cursor");
    router.push(`/dashboard/${encodeURIComponent(ws)}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput.trim() || null });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    router.push(`/dashboard/${encodeURIComponent(ws)}?tab=requests`);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetchWorkspaceRequests(
        ws,
        buildRequestsQuery(
          {
            product: currentProduct,
            statusType: currentStatusType,
            categoryId: currentCategoryId,
            createdFrom: currentCreatedFrom,
            createdTo: currentCreatedTo,
            sort: currentSort,
            search: currentSearch,
          },
          nextCursor
        )
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : "Failed to load more requests.");
    } finally {
      setLoadingMore(false);
    }
  };

  const isFiltered = Boolean(
    currentProduct ||
      currentStatusType ||
      currentSearch ||
      currentCategoryId ||
      currentCreatedFrom ||
      currentCreatedTo ||
      currentSort !== "top"
  );

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        {/* Top row: Search input + Sort + Reset */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search all feedback requests..."
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateFilters({ search: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {/* Sort Filter */}
            <div className="w-40">
              <NativeSelect
                value={currentSort}
                onChange={(e) => updateFilters({ sort: e.target.value })}
                aria-label="Sort requests"
              >
                <option value="top">Top (votes)</option>
                <option value="new">Newest</option>
                <option value="activity">Recent activity</option>
              </NativeSelect>
            </div>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Product Filter */}
          <div className="w-40">
            <NativeSelect
              value={currentProduct}
              onChange={(e) => updateFilters({ product: e.target.value || null, categoryId: null })}
              aria-label="Filter by product"
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Status Type Filter */}
          <div className="w-36">
            <NativeSelect
              value={currentStatusType}
              onChange={(e) => updateFilters({ statusType: e.target.value || null })}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="review">Under Review</option>
              <option value="planned">Planned</option>
              <option value="active">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </NativeSelect>
          </div>

          {/* Category Filter (needs a product) */}
          <div className="w-40">
            <NativeSelect
              value={currentCategoryId}
              onChange={(e) => updateFilters({ categoryId: e.target.value || null })}
              aria-label="Filter by category"
              disabled={!currentProduct}
              title={currentProduct ? undefined : "Select a product to filter by category"}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Created date range (UTC) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium shrink-0">From</span>
            <Input
              type="date"
              value={currentCreatedFrom}
              max={currentCreatedTo || undefined}
              onChange={(e) => updateFilters({ createdFrom: e.target.value || null })}
              aria-label="Created from (UTC)"
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium shrink-0">To</span>
            <Input
              type="date"
              value={currentCreatedTo}
              min={currentCreatedFrom || undefined}
              onChange={(e) => updateFilters({ createdTo: e.target.value || null })}
              aria-label="Created to (UTC)"
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {items.length} of {totalCount} request{totalCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Request Items List */}
      {items.length === 0 ? (
        <EmptyState
          title="No requests match your filter"
          body={
            isFiltered
              ? "Try adjusting your search query, status, product, category, or date filter to find what you're looking for."
              : "No feedback requests have been submitted across your workspace products yet."
          }
          action={
            isFiltered ? (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((req) => (
            <div
              key={req.id}
              className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors"
            >
              {/* Vote Count Indicator */}
              <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 rounded-lg border border-border bg-background text-foreground font-semibold text-xs gap-0.5">
                <ChevronUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{req.voteCount}</span>
              </div>

              {/* Request Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                    <Link
                      href={dashboardPostHref(ws, req.product.slug, req.number)}
                      className="text-sm font-semibold text-foreground hover:underline"
                    >
                      {req.title}
                    </Link>
                    <span className="text-xs text-muted-foreground font-mono">
                      #{req.number}
                    </span>
                  </div>

                  {/* Actions / Links: Dashboard & Public portal */}
                  <div className="flex items-center gap-2 text-xs">
                    <Link
                      href={dashboardPostHref(ws, req.product.slug, req.number)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
                      title="Open in platform dashboard"
                    >
                      <span>Dashboard</span>
                    </Link>
                    {boardEnabled.has(req.product.slug) && (
                      <>
                    <span className="text-muted-foreground/40">·</span>
                    <a
                      href={postHref(ws, req.product.slug, req.number, req.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
                      title="Open public portal post"
                    >
                      <span>Public portal</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                      </>
                    )}
                  </div>
                </div>

                {req.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {req.description}
                  </p>
                )}

                {/* Metadata Row */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-muted-foreground">
                  {/* Product Badge */}
                  <Link
                    href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(req.product.slug)}/board`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-background text-foreground font-medium hover:border-foreground/30 transition-colors"
                  >
                    <EntityLogo
                      src={req.product.logoUrl}
                      name={req.product.name}
                      size={20}
                      style={{
                        "--entity-accent": req.product.accentColor,
                      } as React.CSSProperties}
                    />
                    <span>{req.product.name}</span>
                  </Link>

                  {/* Status Badge */}
                  <StatusBadge
                    name={req.status.name}
                    color={req.status.color}
                    className="h-5 text-[11px]"
                  />

                  {/* Category Pill */}
                  {req.category && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium text-[11px]">
                      {req.category.name}
                    </span>
                  )}

                  <span className="text-muted-foreground/60">·</span>

                  {/* Author, Contact & Location */}
                  <span className="font-medium text-foreground">
                    {req.author.deleted
                      ? "Deleted user"
                      : req.author.name || "Anonymous"}
                  </span>

                  {req.author.email && (
                    <a
                      href={`mailto:${req.author.email}`}
                      className="inline-flex items-center gap-1 hover:underline text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors"
                      title={`Email ${req.author.email}`}
                    >
                      <Mail className="size-3 shrink-0" aria-hidden="true" />
                      <span>{req.author.email}</span>
                    </a>
                  )}

                  {req.author.location && (req.author.location.country || req.author.location.city) && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[11px]"
                      title={[req.author.location.city, req.author.location.country].filter(Boolean).join(", ")}
                    >
                      <MapPin className="size-3 shrink-0 text-muted-foreground/80" aria-hidden="true" />
                      <span>{req.author.location.country ?? req.author.location.city}</span>
                    </span>
                  )}

                  <span>{formatRelativeTime(req.createdAt)}</span>

                  {/* Comment Count */}
                  {req.commentCount > 0 && (
                    <>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3 text-muted-foreground" aria-hidden="true" />
                        <span>{req.commentCount}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoadMoreFooter
        hasNext={Boolean(nextCursor)}
        loading={loadingMore}
        error={loadError}
        onLoadMore={handleLoadMore}
        onRetry={handleLoadMore}
      />
    </div>
  );
}
