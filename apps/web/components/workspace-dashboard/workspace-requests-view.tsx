"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  ChevronUp,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import type { WorkspaceRequestItem, ProductSummary } from "@userhq/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { EntityLogo } from "@/components/entity-logo";
import { EmptyState } from "@/components/empty-state";
import { fetchWorkspaceRequests } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
}: WorkspaceRequestsViewProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = React.useState<WorkspaceRequestItem[]>(initialRequests);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [totalCount, setTotalCount] = React.useState<number>(initialTotalCount);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(currentSearch);

  React.useEffect(() => {
    setItems(initialRequests);
    setNextCursor(initialNextCursor);
    setTotalCount(initialTotalCount);
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
    try {
      const res = await fetchWorkspaceRequests(ws, {
        product: currentProduct || undefined,
        statusType: (currentStatusType as any) || undefined,
        sort: (currentSort as any) || undefined,
        search: currentSearch || undefined,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const isFiltered = Boolean(currentProduct || currentStatusType || currentSearch || currentSort !== "top");

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Product Filter */}
          <div className="w-40">
            <NativeSelect
              value={currentProduct}
              onChange={(e) => updateFilters({ product: e.target.value || null })}
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

          {/* Sort Filter */}
          <div className="w-36">
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
              ? "Try adjusting your search query, status, or product filter to find what you're looking for."
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
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(req.product.slug)}/posts/${req.number}`}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {req.title}
                  </Link>
                  <span className="text-xs text-muted-foreground font-mono">
                    #{req.number}
                  </span>
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

                  {/* Author & Timestamp */}
                  <span>
                    {req.author.deleted
                      ? "Deleted user"
                      : req.author.name || "Anonymous"}
                  </span>
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

      {/* Load More Button */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full max-w-xs"
          >
            {loadingMore ? "Loading more..." : "Load more requests"}
          </Button>
        </div>
      )}
    </div>
  );
}
