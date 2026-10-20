import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getStatuses,
  getCategories,
  getAdminPosts,
  getDeletedPosts,
  getDeletedComments,
} from "@/lib/api-server";
import { PageHeader } from "@/components/page-header";
import { TabNav } from "@/components/tab-nav";
import { BoardView } from "./board-view";
import { DeletedItems } from "@/components/dashboard/deleted-items";
import { CategoriesView } from "../categories/categories-view";

interface BoardPageProps {
  params: Promise<{ ws: string; product: string }>;
  searchParams: Promise<{
    view?: string;
    q?: string;
    sort?: string;
    category?: string;
    status?: string;
    cursor?: string;
  }>;
}

export async function generateMetadata({
  params,
}: BoardPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) {
    return { title: "Board · UserHQ" };
  }
  return {
    title: `Board · ${result.data.name}`,
  };
}

export default async function BoardPage({
  params,
  searchParams,
}: BoardPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const query = await searchParams;

  const [productRes, statusesRes, categoriesRes] = await Promise.all([
    getProduct(ws, product),
    getStatuses(ws, product),
    getCategories(ws, product),
  ]);

  if (!productRes.ok || !statusesRes.ok || !categoriesRes.ok) {
    if (
      !productRes.ok &&
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  const isDeletedView = query.view === "deleted";
  const isCategoriesView = query.view === "categories";

  const tabs = [
    { label: "Posts", href: `/dashboard/${ws}/${product}/board` },
    {
      label: "Categories",
      href: `/dashboard/${ws}/${product}/board?view=categories`,
    },
    {
      label: "Deleted",
      href: `/dashboard/${ws}/${product}/board?view=deleted`,
    },
  ];
  const activeHref = isDeletedView
    ? `/dashboard/${ws}/${product}/board?view=deleted`
    : isCategoriesView
    ? `/dashboard/${ws}/${product}/board?view=categories`
    : `/dashboard/${ws}/${product}/board`;

  return (
    <div className="w-full max-w-5xl space-y-6">
      <PageHeader
        title="Board"
        description={`Every post on ${productRes.data.name}'s public board. Change statuses, merge duplicates, and restore deleted posts here.`}
      />

      <TabNav tabs={tabs} activeHref={activeHref} className="mb-6" />

      {isDeletedView ? (
        <DeletedViewLoader
          ws={ws}
          product={product}
          cursor={query.cursor}
        />
      ) : isCategoriesView ? (
        <CategoriesView
          ws={ws}
          product={product}
          initial={categoriesRes.data}
          showHeader={false}
        />
      ) : (
        <PostsViewLoader
          ws={ws}
          product={product}
          query={query}
          statuses={statusesRes.data}
          categories={categoriesRes.data}
        />
      )}
    </div>
  );
}

async function DeletedViewLoader({
  ws,
  product,
  cursor,
}: {
  ws: string;
  product: string;
  cursor?: string;
}) {
  const [deletedPostsRes, deletedCommentsRes] = await Promise.all([
    getDeletedPosts(ws, product, cursor),
    getDeletedComments(ws, product),
  ]);

  if (!deletedPostsRes.ok || !deletedCommentsRes.ok) {
    notFound();
  }

  return (
    <DeletedItems
      ws={ws}
      product={product}
      initialPosts={deletedPostsRes.data.posts}
      initialPostsCursor={deletedPostsRes.data.nextCursor}
      initialComments={deletedCommentsRes.data.comments}
      initialCommentsCursor={deletedCommentsRes.data.nextCursor}
    />
  );
}

async function PostsViewLoader({
  ws,
  product,
  query,
  statuses,
  categories,
}: {
  ws: string;
  product: string;
  query: {
    q?: string;
    sort?: string;
    category?: string;
    status?: string;
    cursor?: string;
  };
  statuses: any[];
  categories: any[];
}) {
  const postsRes = await getAdminPosts(ws, product, query);

  if (!postsRes.ok) {
    notFound();
  }

  const isFiltered = Boolean(
    query.q ||
      (query.sort && query.sort !== "new") ||
      query.category ||
      query.status
  );

  return (
    <BoardView
      ws={ws}
      product={product}
      initialPosts={postsRes.data.posts}
      initialNextCursor={postsRes.data.nextCursor}
      statuses={statuses}
      categories={categories}
      isFiltered={isFiltered}
    />
  );
}
