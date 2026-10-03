import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getProduct,
  getStatuses,
  getCategories,
  getAdminPost,
} from "@/lib/api-server";
import { PostDetailView } from "./post-detail-view";

interface DashboardPostPageProps {
  params: Promise<{ ws: string; product: string; number: string }>;
}

export async function generateMetadata({
  params,
}: DashboardPostPageProps): Promise<Metadata> {
  const { ws, product, number } = await params;
  const postNumber = parseInt(number, 10);
  if (isNaN(postNumber)) return {};

  const [productRes, postRes] = await Promise.all([
    getProduct(ws, product),
    getAdminPost(ws, product, postNumber),
  ]);

  if (!productRes.ok || !postRes.ok) return {};
  if (postRes.data.kind === "redirect") return {};

  return {
    title: `${postRes.data.post.title} · ${productRes.data.name}`,
  };
}

export default async function DashboardPostPage({
  params,
}: DashboardPostPageProps): Promise<React.JSX.Element | null> {
  const { ws, product, number } = await params;
  const postNumber = parseInt(number, 10);
  if (isNaN(postNumber)) {
    notFound();
  }

  const [productRes, statusesRes, categoriesRes, postRes] =
    await Promise.all([
      getProduct(ws, product),
      getStatuses(ws, product),
      getCategories(ws, product),
      getAdminPost(ws, product, postNumber),
    ]);

  if (
    !productRes.ok ||
    !statusesRes.ok ||
    !categoriesRes.ok ||
    !postRes.ok
  ) {
    if (
      !productRes.ok &&
      productRes.status === 403 &&
      productRes.code === "workspace_suspended"
    ) {
      return null;
    }
    notFound();
  }

  if (postRes.data.kind === "redirect") {
    redirect(
      `/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board/${postRes.data.number}`
    );
  }

  const { post, deleted, viewer, timeline } = postRes.data;

  return (
    <PostDetailView
      ws={ws}
      product={product}
      post={post}
      initialDeleted={deleted}
      viewer={viewer}
      timeline={timeline}
      statuses={statusesRes.data}
      categories={categoriesRes.data}
    />
  );
}
