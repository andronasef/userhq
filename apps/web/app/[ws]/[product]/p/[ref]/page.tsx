import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPortalProduct, getPost } from "@/lib/api-server";
import { parsePostRef, portalHref } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { VoteButton } from "@/components/board/vote-button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { AuthorLine } from "@/components/post/author-line";
import { PlainText } from "@/components/plain-text";

interface PostPageProps {
  params: Promise<{ ws: string; product: string; ref: string }>;
}

export default async function PostPage({
  params,
}: PostPageProps): Promise<React.JSX.Element> {
  const { ws, product, ref } = await params;
  const postNumber = parsePostRef(ref);
  if (!postNumber) {
    notFound();
  }

  const [productResult, postResult] = await Promise.all([
    getPortalProduct(ws, product),
    getPost(ws, product, postNumber),
  ]);

  if (!productResult.ok || !postResult.ok) {
    notFound();
  }

  if (postResult.data.kind === "redirect") {
    notFound();
  }

  const { post, viewer } = postResult.data;

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
    </div>
  );
}
