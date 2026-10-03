import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getBoard, getMe } from "@/lib/api-server";
import { PostRow } from "@/components/board/post-row";
import { NewPostButton } from "@/components/board/post-form-dialog";
import { EmptyState } from "@/components/empty-state";

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
  const [productResult, boardResult, me] = await Promise.all([
    getPortalProduct(ws, product),
    getBoard(ws, product, ""),
    getMe(),
  ]);

  if (!productResult.ok) {
    notFound();
  }

  const productName = productResult.data.product.name;
  const posts = boardResult.ok ? boardResult.data.posts : [];
  const signedIn = !!me.user;
  const defaultOpen = sp?.new === "1";

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
          signedIn={signedIn}
          defaultOpen={defaultOpen}
        />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={`Share an idea for ${productName}, and others can vote on it.`}
          action={
            <NewPostButton
              ws={ws}
              product={product}
              signedIn={signedIn}
              defaultOpen={defaultOpen}
            />
          }
        />
      ) : (
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
      )}
    </div>
  );
}
