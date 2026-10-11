"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type {
  PublicPostDetail,
  PostViewer,
  TimelineItem,
  PostStatus,
} from "@userhq/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { PlainText } from "@/components/plain-text";
import { VoterList } from "@/components/post/voter-list";
import { PostTimeline } from "@/components/post/post-timeline";
import { PostActionsMenu } from "@/components/post/post-actions-menu";
import { StatusChangeDialog } from "@/components/post/status-change-dialog";
import { LinkedRoadmapBanner } from "@/components/post/linked-roadmap-banner";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";

export interface PostDetailViewProps {
  ws: string;
  product: string;
  post: PublicPostDetail;
  initialDeleted: boolean;
  viewer: PostViewer;
  timeline: TimelineItem[];
  statuses: PostStatus[];
  categories: { id: string; name: string }[];
}

export function PostDetailView({
  ws,
  product,
  post,
  initialDeleted,
  viewer,
  timeline,
  statuses,
  categories,
}: PostDetailViewProps): React.JSX.Element {
  const router = useRouter();
  const [deleted, setDeleted] = React.useState(initialDeleted);
  const [restoring, setRestoring] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);

  const handleRestorePost = async () => {
    setRestoring(true);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${post.number}/restore`,
        { method: "POST" }
      );
      toast.success("Post restored");
      setDeleted(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore post."
      );
    } finally {
      setRestoring(false);
    }
  };

  const isStatusLocked = Boolean(post.roadmapItem);

  const authorName = post.author.deleted
    ? "Deleted user"
    : (post.author.name ?? "Anonymous");

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-3 w-fit text-muted-foreground hover:text-foreground"
        >
          <Link
            href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Back to board</span>
          </Link>
        </Button>
      </div>

      {deleted && (
        <Alert
          variant="neutral"
          className="flex items-center justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <span>This post is deleted. It's hidden from the portal.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestorePost}
            disabled={restoring}
          >
            {restoring ? "Restoring…" : "Restore post"}
          </Button>
        </Alert>
      )}

      {post.roadmapItem && (
        <LinkedRoadmapBanner
          ws={ws}
          product={product}
          roadmapItem={post.roadmapItem}
          statusName={post.status.name}
          statusColor={post.status.color}
          variant="admin"
        />
      )}

      <PageHeader
        title={post.title}
        description={`#${post.number} · Posted by ${authorName} on ${formatDate(post.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(true)}
              disabled={isStatusLocked}
              title={isStatusLocked ? "Status is locked to the linked roadmap item. Move the item on the roadmap to change status." : undefined}
            >
              Change status
            </Button>
            <PostActionsMenu
              ws={ws}
              product={product}
              post={post}
              statuses={statuses}
              categories={categories}
              adminView={true}
              viewer={viewer}
              variant="dashboard"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge name={post.status.name} color={post.status.color} />
        {post.category && (
          <Badge variant="neutral">{post.category.name}</Badge>
        )}
        {post.editedAt && (
          <span className="text-sm text-muted-foreground">· edited</span>
        )}
      </div>

      {post.description && (
        <div className="text-base text-foreground">
          <PlainText text={post.description} />
        </div>
      )}

      <section
        aria-labelledby="voters-heading"
        className="flex flex-col gap-4 border-t border-border pt-8"
      >
        <h2
          id="voters-heading"
          className="text-base font-semibold text-foreground"
        >
          Voters ({post.voteCount})
        </h2>
        <VoterList ws={ws} product={product} postNumber={post.number} />
      </section>

      <section
        aria-labelledby="comments-heading"
        className="border-t border-border pt-8 flex flex-col gap-6"
      >
        <h2
          id="comments-heading"
          className="text-base font-semibold text-foreground"
        >
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

      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        ws={ws}
        product={product}
        postNumber={post.number}
        currentStatusId={post.status.id}
        version={post.version}
        statuses={statuses}
      />
    </div>
  );
}
