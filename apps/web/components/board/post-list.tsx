"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { PublicBoardPageSchema, type PublicBoardPage } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { QueryProvider } from "@/lib/query-client";
import { PostRow } from "./post-row";
import { Button } from "../ui/button";

export interface PostListProps {
  ws: string;
  product: string;
  search: string;
  initial: PublicBoardPage;
  signedIn?: boolean;
}

function PostListInner({
  ws,
  product,
  search,
  initial,
  signedIn,
}: PostListProps): React.JSX.Element {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["board", ws, product, search],
      initialData: {
        pages: [initial],
        pageParams: [null],
      },
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams(search);
        if (pageParam) {
          params.set("cursor", pageParam as string);
        }
        const qs = params.toString() ? `?${params.toString()}` : "";
        const url = `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts${qs}`;
        return apiFetch(url, { schema: PublicBoardPageSchema });
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: null as string | null,
    });

  const seenNumbers = new Set<number>();
  const posts = (data?.pages ?? []).flatMap((p) => p.posts).filter((post) => {
    if (seenNumbers.has(post.number)) return false;
    seenNumbers.add(post.number);
    return true;
  });

  const initialCount = initial.posts.length;
  const loadedCount = Math.max(0, posts.length - initialCount);

  return (
    <div>
      <ul className="rounded-lg border border-border divide-y divide-border">
        {posts.map((post) => (
          <PostRow
            key={post.number}
            ws={ws}
            product={product}
            post={post}
            signedIn={signedIn}
          />
        ))}
      </ul>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                <span>Loading…</span>
              </>
            ) : (
              <span>Load more</span>
            )}
          </Button>
        </div>
      )}

      <div className="sr-only" aria-live="polite" role="status">
        {loadedCount > 0 ? `Loaded ${loadedCount} more posts` : ""}
      </div>
    </div>
  );
}

export function PostList(props: PostListProps): React.JSX.Element {
  return (
    <QueryProvider>
      <PostListInner {...props} />
    </QueryProvider>
  );
}
