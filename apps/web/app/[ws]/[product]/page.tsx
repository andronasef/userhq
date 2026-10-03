import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getBoard, getMe } from "@/lib/api-server";
import { NewPostButton } from "@/components/board/post-form-dialog";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { PostList } from "@/components/board/post-list";
import { EmptyState } from "@/components/empty-state";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

interface PortalBoardPageProps {
  params: Promise<{ ws: string; product: string }>;
  searchParams: Promise<{ new?: string; [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: PortalBoardPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) return {};
  return {
    title: `Feedback · ${result.data.product.name}`,
  };
}

export default async function PortalBoardPage({
  params,
  searchParams,
}: PortalBoardPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const sp = await searchParams;

  const searchParamsObj = new URLSearchParams();
  for (const key of ["q", "sort", "category", "status"]) {
    const val = sp?.[key];
    if (typeof val === "string" && val.trim() !== "") {
      searchParamsObj.set(key, val);
    }
  }
  const search = searchParamsObj.toString();

  const [productResult, boardResult, me] = await Promise.all([
    getPortalProduct(ws, product),
    getBoard(ws, product, search),
    getMe(),
  ]);

  if (!productResult.ok) {
    notFound();
  }

  const productName = productResult.data.product.name;
  const categories = productResult.data.categories;
  const statuses = productResult.data.statuses;
  const initialBoard = boardResult.ok
    ? boardResult.data
    : { posts: [], nextCursor: null };
  const posts = initialBoard.posts;
  const signedIn = !!me.user;
  const defaultOpen = sp?.new === "1";

  const isFiltered = Boolean(
    sp?.q || sp?.category || sp?.status || (sp?.sort && sp?.sort !== "top")
  );

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share ideas for {productName} and vote on the ones you want most.
          </p>
        </div>
        <NewPostButton
          ws={ws}
          product={product}
          categories={categories}
          signedIn={signedIn}
          defaultOpen={defaultOpen}
        />
      </div>

      <BoardToolbar categories={categories} statuses={statuses} />

      {posts.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title="No posts match"
            body="Try a different search, or clear the filters to see every open post."
            action={
              <Link
                href={`/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Nothing here yet"
            body={`Share an idea for ${productName}, and others can vote on it.`}
            action={
              <NewPostButton
                ws={ws}
                product={product}
                categories={categories}
                signedIn={signedIn}
                defaultOpen={defaultOpen}
              />
            }
          />
        )
      ) : (
        <PostList
          key={search}
          ws={ws}
          product={product}
          search={search}
          initial={initialBoard}
          signedIn={signedIn}
        />
      )}
    </div>
  );
}
