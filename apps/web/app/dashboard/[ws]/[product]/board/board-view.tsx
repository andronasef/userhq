"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AdminPostRow, AdminPostPage, PostStatus } from "@userhq/types";
import { BoardFilters } from "@/components/dashboard/board-filters";
import { BoardTable } from "@/components/dashboard/board-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { portalHref } from "@/lib/tenant";
import { apiFetch } from "@/lib/api-client";

import { useI18n } from "@/lib/i18n/context";

export interface BoardViewProps {
  ws: string;
  product: string;
  boardEnabled: boolean;
  initialPosts: AdminPostRow[];
  initialNextCursor: string | null;
  statuses: PostStatus[];
  categories: { id: string; name: string }[];
  isFiltered: boolean;
}

export function BoardView({
  ws,
  product,
  boardEnabled,
  initialPosts,
  initialNextCursor,
  statuses,
  categories,
  isFiltered,
}: BoardViewProps): React.JSX.Element {
  const { t } = useI18n();
  const router = useRouter();
  const [posts, setPosts] = React.useState<AdminPostRow[]>(initialPosts);
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    initialNextCursor
  );
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    setPosts(initialPosts);
    setNextCursor(initialNextCursor);
  }, [initialPosts, initialNextCursor]);

  const handleClearFilters = () => {
    router.push(`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board`);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = new URL(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts`,
        window.location.origin
      );
      // forward current query string
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set("cursor", nextCursor);
      url.search = searchParams.toString();

      const res = await apiFetch<AdminPostPage>(url.pathname + url.search);
      setPosts((prev) => [...prev, ...res.posts]);
      setNextCursor(res.nextCursor);
      setLiveAnnouncement(t("board.loadedMoreAnnounce", { count: res.posts.length }));
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col">
      <BoardFilters categories={categories} statuses={statuses} />

      {posts.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title={t("board.noPostsMatch")}
            body={t("board.noPostsMatchBody")}
            action={
              <Button variant="outline" onClick={handleClearFilters}>
                {t("board.clearFilters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t("board.noPostsYet")}
            body={t("board.noPostsYetBody")}
            action={
              // U6: a hidden Board has no public page to link to.
              boardEnabled ? (
                <Button variant="outline" asChild>
                  <a
                    href={portalHref(ws, product)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("board.viewPortal")}
                  </a>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <BoardTable
            ws={ws}
            product={product}
            boardEnabled={boardEnabled}
            posts={posts}
            statuses={statuses}
            categories={categories}
          />

          {nextCursor && (
            <div className="py-6 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? t("board.loading") : t("board.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}

      {liveAnnouncement && (
        <p className="sr-only" role="status" aria-live="polite">
          {liveAnnouncement}
        </p>
      )}
    </div>
  );
}
