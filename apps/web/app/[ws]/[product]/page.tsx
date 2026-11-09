import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalProduct, getBoard, getMe } from "@/lib/api-server";
import { NewPostButton } from "@/components/board/post-form-dialog";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { PostList } from "@/components/board/post-list";
import { EmptyState } from "@/components/empty-state";
import { getDictionary } from "@/lib/i18n";

import Link from "next/link";
import { landingHref } from "@/lib/portal-features";
import { StatePage } from "@/components/state-page";
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
  const features = result.data.product.features;
  if (!landingHref(ws, product, features)) return { robots: { index: false, follow: false } };
  if (!features.board) return {};
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

  const productResult = await getPortalProduct(ws, product);
  if (!productResult.ok) notFound();
  const p = productResult.data.product;
  if (!p.features.board) {
    const href = landingHref(ws, product, p.features);
    if (href) redirect(href);
    const company = productResult.data.workspace.name;
    return (
      <div className="mx-auto max-w-3xl py-12 break-words">
        <StatePage
          title="Nothing is available here right now"
          body={`${p.name} isn't open to visitors at the moment. Please check back later.`}
          actions={p.websiteUrl ? <Link href={p.websiteUrl} className={buttonVariants({ variant: "outline" })}>Visit {company}</Link> : undefined}
        />
      </div>
    );
  }
  const [boardResult, me] = await Promise.all([getBoard(ws, product, search), getMe()]);
  if (!boardResult.ok && boardResult.status === 404) notFound();

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

  const dict = getDictionary(
    (productResult.data.product as { resolvedLocale?: string }).resolvedLocale ??
      (typeof sp.lang === "string" ? sp.lang : undefined)
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
            title={dict.ui.noPostsMatch}
            body={dict.ui.noPostsMatchDesc}
            action={
              <Link
                href={`/${encodeURIComponent(ws)}/${encodeURIComponent(product)}`}
                className={buttonVariants({ variant: "outline" })}
              >
                {dict.ui.clearFilters}
              </Link>
            }
          />
        ) : (
          <EmptyState
            title={dict.ui.nothingHereYet}
            body={dict.ui.shareAnIdeaDesc}
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
