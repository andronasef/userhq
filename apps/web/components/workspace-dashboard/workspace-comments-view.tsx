"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  RotateCcw,
  Reply,
  Send,
  Inbox,
  AlertCircle,
  ExternalLink,
  Mail,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceCommentItem, ProductSummary } from "@userhq/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Avatar } from "@/components/ui/avatar";
import { EntityLogo } from "@/components/entity-logo";
import { EmptyState } from "@/components/empty-state";
import {
  fetchWorkspaceComments,
  markCommentHandled,
  reopenComment,
  replyWorkspaceComment,
  markCommentRead,
} from "@/lib/api-client";
import { postHref, dashboardPostHref } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { applyReplyToFeed } from "@/lib/workspace-inbox";
import { useI18n } from "@/lib/i18n/context";

export interface WorkspaceCommentsViewProps {
  ws: string;
  products: ProductSummary[];
  initialComments: WorkspaceCommentItem[];
  initialNextCursor: string | null;
  initialNeedsAttentionCount: number;
  currentProduct?: string;
  currentAttention?: "needs_attention" | "handled" | "all";
}

function formatRelativeTime(
  dateString: string,
  t: (path: any, params?: any) => string,
  locale: string
): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t("common.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("common.minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("common.hoursAgo", { count: diffHr });
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return t("common.daysAgo", { count: diffDays });
  return new Date(dateString).toLocaleDateString(locale);
}

export function WorkspaceCommentsView({
  ws,
  products,
  initialComments,
  initialNextCursor,
  initialNeedsAttentionCount,
  currentProduct = "",
  currentAttention = "needs_attention",
}: WorkspaceCommentsViewProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const boardEnabled = new Set(
    products.filter((p) => p.features?.board).map((p) => p.slug)
  );
  const [comments, setComments] = React.useState<WorkspaceCommentItem[]>(initialComments);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [needsAttentionCount, setNeedsAttentionCount] = React.useState<number>(initialNeedsAttentionCount);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Active reply editor state
  const [replyingCommentId, setReplyingCommentId] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [isSubmittingReply, setIsSubmittingReply] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setComments(initialComments);
    setNextCursor(initialNextCursor);
    setNeedsAttentionCount(initialNeedsAttentionCount);
  }, [initialComments, initialNextCursor, initialNeedsAttentionCount]);

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "comments");
    for (const [k, v] of Object.entries(updates)) {
      if (!v) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    params.delete("cursor");
    router.push(`/dashboard/${encodeURIComponent(ws)}?${params.toString()}`);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchWorkspaceComments(ws, {
        product: currentProduct || undefined,
        attention: currentAttention,
        cursor: nextCursor,
      });
      setComments((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch {
      toast.error(t("workspace.failedLoadComments"));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkHandled = async (commentId: string) => {
    setActionLoadingId(commentId);
    try {
      await markCommentHandled(ws, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                handledAt: new Date().toISOString(),
                handledBy: { name: "You", image: null, isAdmin: true, deleted: false },
              }
            : c
        )
      );
      setNeedsAttentionCount((prev) => Math.max(0, prev - 1));
      toast.success(t("workspace.commentMarkedHandled"));
    } catch {
      toast.error(t("workspace.failedMarkHandled"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReopen = async (commentId: string) => {
    setActionLoadingId(commentId);
    try {
      await reopenComment(ws, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                handledAt: null,
                handledBy: null,
              }
            : c
        )
      );
      setNeedsAttentionCount((prev) => prev + 1);
      toast.success(t("workspace.commentReopened"));
    } catch {
      toast.error(t("workspace.failedReopenComment"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReply = (commentId: string) => {
    setReplyingCommentId(commentId);
    setReplyBody("");
  };

  const handleSendReply = async (commentId: string) => {
    if (!replyBody.trim()) return;
    setIsSubmittingReply(true);
    try {
      const reply = await replyWorkspaceComment(ws, commentId, { body: replyBody.trim() });
      // D-04: a reply resolves the thread. Show it now; the refresh brings thread-mates resolved server-side.
      const applied = applyReplyToFeed(comments, commentId, reply, currentAttention);
      setComments(applied.items);
      setNeedsAttentionCount((prev) => Math.max(0, prev + applied.needsAttentionDelta));
      setReplyingCommentId(null);
      setReplyBody("");
      toast.success(t("workspace.replyPostedHandled"));
      router.refresh();
    } catch {
      toast.error(t("workspace.failedPostReply"));
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleMarkRead = async (commentId: string) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isUnread: false } : c)));
    try {
      await markCommentRead(ws, commentId);
    } catch {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isUnread: true } : c)));
      toast.error(t("workspace.failedMarkRead"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Attention filter and Product dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Attention segmented controls */}
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
          <button
            type="button"
            onClick={() => updateFilters({ attention: "needs_attention" })}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors",
              currentAttention === "needs_attention"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{t("workspace.needsAttention")}</span>
            {needsAttentionCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {needsAttentionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => updateFilters({ attention: "handled" })}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              currentAttention === "handled"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("workspace.handled")}
          </button>

          <button
            type="button"
            onClick={() => updateFilters({ attention: "all" })}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              currentAttention === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("workspace.allComments")}
          </button>
        </div>

        {/* Product selector */}
        <div className="w-48 self-end sm:self-auto">
          <NativeSelect
            value={currentProduct}
            onChange={(e) => updateFilters({ product: e.target.value || null })}
            aria-label={t("workspace.filterCommentsProduct")}
          >
            <option value="">{t("workspace.allProducts")}</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <EmptyState
          title={
            currentAttention === "needs_attention"
              ? t("workspace.allCaughtUpTitle")
              : currentAttention === "handled"
                ? t("workspace.noHandledCommentsTitle")
                : t("workspace.noCommentsFoundTitle")
          }
          body={
            currentAttention === "needs_attention"
              ? t("workspace.allCaughtUpBody")
              : currentAttention === "handled"
                ? t("workspace.noHandledCommentsBody")
                : t("workspace.noCommentsFoundBody")
          }
          icon={
            currentAttention === "needs_attention" ? (
              <CheckCircle2 className="size-8 text-emerald-500" aria-hidden="true" />
            ) : (
              <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
            )
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {comments.map((comment) => {
            const isReplying = replyingCommentId === comment.id;
            const isHandled = Boolean(comment.handledAt || comment.isAdmin);
            const isNeedsAttention = !isHandled;

            return (
              <div
                key={comment.id}
                className={cn(
                  "p-4 space-y-3 transition-colors",
                  comment.isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                )}
              >
                {/* Header: Post Link + Product Pill + Unread Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Unread indicator */}
                    {comment.isUnread && (
                      <span
                        className="size-2 rounded-full bg-primary shrink-0"
                        title={t("workspace.unreadComment")}
                        aria-label={t("workspace.unreadComment")}
                      />
                    )}

                    {/* Product Badge */}
                    <Link
                      href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(comment.product.slug)}/board`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-background text-foreground font-medium hover:border-foreground/30 transition-colors shrink-0"
                    >
                      <EntityLogo
                        src={comment.product.logoUrl}
                        name={comment.product.name}
                        size={20}
                        style={{
                          "--entity-accent": comment.product.accentColor,
                        } as React.CSSProperties}
                      />
                      <span>{comment.product.name}</span>
                    </Link>

                    {/* Post Title */}
                    <span className="text-muted-foreground font-mono">{t("workspace.onPost")}</span>
                    <Link
                      href={dashboardPostHref(ws, comment.product.slug, comment.post.number)}
                      className="font-semibold text-foreground hover:underline truncate max-w-xs sm:max-w-sm"
                    >
                      {comment.post.title}
                    </Link>
                    <span className="text-muted-foreground font-mono">
                      #{comment.post.number}
                    </span>

                    {/* Actions / Links: Dashboard & Public portal */}
                    <div className="inline-flex items-center gap-1.5 ml-1">
                      <Link
                        href={dashboardPostHref(ws, comment.product.slug, comment.post.number)}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                        title={t("workspace.openDashboardHint")}
                      >
                        {t("workspace.dashboardLink")}
                      </Link>
                      {boardEnabled.has(comment.product.slug) && (
                        <>
                      <span className="text-muted-foreground/40">·</span>
                      <a
                        href={postHref(ws, comment.product.slug, comment.post.number, comment.post.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                        title={t("workspace.openPortalPostHint")}
                      >
                        <span>{t("workspace.publicPortalLink")}</span>
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {isNeedsAttention && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="size-3" aria-hidden="true" />
                      {t("workspace.needsAttention")}
                    </span>
                  )}
                  {comment.handledAt && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground bg-muted">
                      <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                      {t("workspace.handled")}
                    </span>
                  )}
                </div>

                {/* Comment Body */}
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {comment.body}
                </p>

                {/* Footer: Author Info + Actions */}
                <div className="flex items-center justify-between gap-4 pt-1 flex-wrap text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={comment.author.image}
                      name={comment.author.name || t("ui.anonymous")}
                      size="sm"
                      className="size-5"
                    />
                    <span className="font-medium text-foreground">
                      {comment.author.deleted
                        ? t("ui.deletedUser")
                        : comment.author.name || t("ui.anonymous")}
                    </span>
                    {comment.author.isAdmin && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/10 text-[var(--primary-text)]">
                        {t("ui.adminBadge")}
                      </span>
                    )}
                    {comment.author.email && (
                      <a
                        href={`mailto:${comment.author.email}`}
                        className="inline-flex items-center gap-1 hover:underline text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors"
                        title={t("workspace.emailAuthorHint", { email: comment.author.email })}
                      >
                        <Mail className="size-3 shrink-0" aria-hidden="true" />
                        <span>{comment.author.email}</span>
                      </a>
                    )}
                    {comment.author.location && (comment.author.location.country || comment.author.location.city) && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[11px]"
                        title={[comment.author.location.city, comment.author.location.country].filter(Boolean).join(", ")}
                      >
                        <MapPin className="size-3 shrink-0 text-muted-foreground/80" aria-hidden="true" />
                        <span>{comment.author.location.country ?? comment.author.location.city}</span>
                      </span>
                    )}
                    <span>·</span>
                    <span>{formatRelativeTime(comment.createdAt, t, locale)}</span>
                    {comment.handledAt && comment.handledBy && (comment.handledBy.deleted || comment.handledBy.name) && (
                      <>
                        <span>·</span>
                        <span className="text-muted-foreground/80">
                          {comment.handledBy.deleted
                            ? t("workspace.handledByFormerMember")
                            : t("workspace.handledByName", { name: comment.handledBy.name })}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {comment.isUnread && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`${t("workspace.markAsRead")}: ${comment.author.name || "Customer"} on ${comment.post.title}`}
                        onClick={() => handleMarkRead(comment.id)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("workspace.markAsRead")}
                      </Button>
                    )}
                    {isNeedsAttention ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoadingId === comment.id}
                        onClick={() => handleMarkHandled(comment.id)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>{t("workspace.markHandled")}</span>
                      </Button>
                    ) : (
                      !comment.isAdmin &&
                      comment.handledAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoadingId === comment.id}
                          onClick={() => handleReopen(comment.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>{t("workspace.reopen")}</span>
                        </Button>
                      )
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isReplying) {
                          setReplyingCommentId(null);
                        } else {
                          handleOpenReply(comment.id);
                        }
                      }}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      <Reply className="size-3.5" />
                      <span>{isReplying ? t("common.cancel") : t("ui.reply")}</span>
                    </Button>
                  </div>
                </div>

                {/* Inline Quick Reply Editor */}
                {isReplying && (
                  <div
                    className="pt-2 pl-4 border-l-2 border-primary/40 space-y-2 mt-2"
                  >
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={t("workspace.replyPlaceholder")}
                      className="text-xs min-h-[72px]"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingCommentId(null)}
                        className="h-7 text-xs"
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!replyBody.trim() || isSubmittingReply}
                        onClick={() => handleSendReply(comment.id)}
                        className="h-7 text-xs gap-1"
                      >
                        <Send className="size-3" />
                        <span>{isSubmittingReply ? t("workspace.postingReply") : t("workspace.sendReply")}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full max-w-xs"
          >
            {loadingMore ? t("workspace.loadingMoreComments") : t("workspace.loadMoreComments")}
          </Button>
        </div>
      )}
    </div>
  );
}
