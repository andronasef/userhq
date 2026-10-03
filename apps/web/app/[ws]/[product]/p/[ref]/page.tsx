import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPortalProduct, getPost, getMe, publicOrigin } from "@/lib/api-server";
import { parsePostRef, portalHref, postHref } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { VoteButton } from "@/components/board/vote-button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { AuthorLine } from "@/components/post/author-line";
import { PlainText } from "@/components/plain-text";
import { PostTimeline } from "@/components/post/post-timeline";
import { PostActionsMenu } from "@/components/post/post-actions-menu";

interface PostPageProps {
  params: Promise<{ ws: string; product: string; ref: string }>;
}

function excerpt(text: string | null | undefined, fallback: string): string {
  if (!text) return fallback;
  const trimmed = text.trim();
  if (trimmed.length <= 160) return trimmed;
  const cut = trimmed.slice(0, 160);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) {
    return cut.slice(0, lastSpace);
  }
  return cut;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { ws, product, ref } = await params;
  const postNumber = parsePostRef(ref);
  if (!postNumber) return {};

  const [productResult, postResult] = await Promise.all([
    getPortalProduct(ws, product),
    getPost(ws, product, postNumber),
  ]);

  if (!productResult.ok || !postResult.ok) return {};
  if (postResult.data.kind === "redirect") return {};

  const p = productResult.data.product;
  const post = postResult.data.post;
  const origin = await publicOrigin();
  const canonicalPath = postHref(ws, product, post.number, post.slug);
  const fallbackDesc =
    p.tagline ?? `Share ideas for ${p.name} and vote on the ones you want most.`;

  const metaDesc = excerpt(post.description, fallbackDesc);

  return {
    title: `${post.title} · ${p.name}`,
    description: metaDesc,
    openGraph: {
      title: post.title,
      description: metaDesc,
    },
    alternates: {
      canonical: `${origin}${canonicalPath}`,
    },
  };
}

export default async function PostPage({
  params,
}: PostPageProps): Promise<React.JSX.Element> {
  const { ws, product, ref } = await params;
  const postNumber = parsePostRef(ref);
  if (!postNumber) {
    notFound();
  }

  const [productResult, postResult, me] = await Promise.all([
    getPortalProduct(ws, product),
    getPost(ws, product, postNumber),
    getMe(),
  ]);

  if (!productResult.ok || !postResult.ok) {
    notFound();
  }

  if (postResult.data.kind === "redirect") {
    permanentRedirect(
      postHref(ws, product, postResult.data.number, postResult.data.slug)
    );
  }

  const { post, viewer, timeline } = postResult.data;
  const canonicalPath = postHref(ws, product, post.number, post.slug);
  const currentPath = `/${ws}/${product}/p/${ref}`;
  if (currentPath !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  const adminView = me.workspaces.some((w) => w.slug === ws);

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-3 w-fit text-muted-foreground hover:text-foreground"
        >
          <Link href={portalHref(ws, product)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>All feedback</span>
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
        <VoteButton
          ws={ws}
          product={product}
          number={post.number}
          title={post.title}
          voteCount={post.voteCount}
          voted={viewer.voted}
          signedIn={viewer.signedIn}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold break-words flex-1 text-foreground">
              {post.title}
            </h1>
            <PostActionsMenu
              ws={ws}
              product={product}
              post={post}
              statuses={productResult.data.statuses}
              categories={productResult.data.categories}
              adminView={adminView}
              viewer={viewer}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge name={post.status.name} color={post.status.color} />
            {post.category && (
              <Badge variant="neutral">{post.category.name}</Badge>
            )}
          </div>
          <div className="mt-2">
            <AuthorLine
              author={post.author}
              createdAt={post.createdAt}
              editedAt={post.editedAt}
            />
          </div>
        </div>
      </div>

      {post.description && (
        <div className="text-base text-foreground">
          <PlainText text={post.description} />
        </div>
      )}

      <section
        aria-labelledby="comments-heading"
        className="border-t border-border pt-8 flex flex-col gap-6"
      >
        <h2 id="comments-heading" className="text-xl font-semibold text-foreground">
          Comments
        </h2>
        <PostTimeline
          ws={ws}
          product={product}
          postNumber={post.number}
          postSlug={post.slug}
          initialTimeline={timeline}
          signedIn={viewer.signedIn}
          viewerIsAdmin={viewer.isAdmin}
        />
      </section>
    </div>
  );
}
