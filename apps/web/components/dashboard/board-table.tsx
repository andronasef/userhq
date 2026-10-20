"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AdminPostRow, PostStatus } from "@userhq/types";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PostActionsMenu } from "@/components/post/post-actions-menu";
import { DeviceBadge } from "@/components/post/device-badge";
import { BulkMergeDialog } from "@/components/dashboard/bulk-merge-dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BoardTableProps {
  ws: string;
  product: string;
  posts: AdminPostRow[];
  statuses: PostStatus[];
  categories?: { id: string; name: string }[];
}

export function BoardTable({
  ws,
  product,
  posts,
  statuses,
  categories = [],
}: BoardTableProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get("q") ?? "";

  const [selectedNumbers, setSelectedNumbers] = React.useState<Set<number>>(
    new Set()
  );
  const [bulkMergeOpen, setBulkMergeOpen] = React.useState(false);
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

  // Clear selection when search query changes
  React.useEffect(() => {
    setSelectedNumbers(new Set());
  }, [searchQuery]);

  // Set indeterminate state on header checkbox
  const isAllSelected =
    posts.length > 0 && selectedNumbers.size === posts.length;
  const isPartial =
    selectedNumbers.size > 0 && selectedNumbers.size < posts.length;

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartial;
    }
  }, [isPartial]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNumbers(new Set(posts.map((p) => p.number)));
    } else {
      setSelectedNumbers(new Set());
    }
  };

  const handleToggleRow = (postNumber: number, checked: boolean) => {
    setSelectedNumbers((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(postNumber);
      } else {
        next.delete(postNumber);
      }
      return next;
    });
  };

  const selectedPosts = React.useMemo(
    () => posts.filter((p) => selectedNumbers.has(p.number)),
    [posts, selectedNumbers]
  );

  return (
    <div className="flex flex-col">
      {selectedNumbers.size >= 1 && (
        <div
          role="region"
          aria-label="Selection"
          className="flex items-center justify-between gap-4 p-3 mb-3 rounded-lg border border-border bg-muted/50"
        >
          <div className="text-sm font-medium text-foreground">
            {selectedNumbers.size} selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedNumbers.size < 2}
              title={
                selectedNumbers.size < 2
                  ? "Select at least 2 posts to merge"
                  : undefined
              }
              onClick={() => setBulkMergeOpen(true)}
            >
              Merge posts…
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNumbers(new Set())}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH className="w-10 px-3">
                <input
                  type="checkbox"
                  ref={headerCheckboxRef}
                  aria-label="Select all posts"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="size-4 accent-foreground cursor-pointer align-middle"
                />
              </TH>
              <TH>Post</TH>
              <TH>Category</TH>
              <TH>Status</TH>
              <TH className="text-right">Votes</TH>
              <TH className="text-right">Comments</TH>
              <TH>Created</TH>
              <TH className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {posts.map((post) => {
              const isSelected = selectedNumbers.has(post.number);
              return (
                <TR
                  key={post.number}
                  className={cn(isSelected && "bg-muted")}
                >
                  <TD className="w-10 px-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${post.title}`}
                      checked={isSelected}
                      onChange={(e) =>
                        handleToggleRow(post.number, e.target.checked)
                      }
                      className="size-4 accent-foreground cursor-pointer align-middle"
                    />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2 max-w-md">
                      <Link
                        href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board/${post.number}`}
                        className="text-sm font-semibold text-foreground hover:underline truncate"
                        title={post.title}
                      >
                        {post.title}
                      </Link>
                      {post.deviceInfo && (
                        <DeviceBadge deviceInfo={post.deviceInfo} />
                      )}
                    </div>
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {post.category?.name ?? "—"}
                  </TD>
                  <TD>
                    <StatusBadge
                      name={post.status.name}
                      color={post.status.color}
                    />
                  </TD>
                  <TD className="text-right tabular-nums text-sm text-foreground">
                    {post.voteCount}
                  </TD>
                  <TD className="text-right tabular-nums text-sm text-foreground">
                    {post.commentCount}
                  </TD>
                  <TD className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(post.createdAt)}
                  </TD>
                  <TD className="text-right">
                    <PostActionsMenu
                      ws={ws}
                      product={product}
                      post={{
                        number: post.number,
                        slug: post.slug,
                        title: post.title,
                        description: null,
                        voteCount: post.voteCount,
                        createdAt: post.createdAt,
                        editedAt: null,
                        version: 1,
                        status: post.status,
                        category: post.category,
                        author: {
                          name: null,
                          image: null,
                          isAdmin: false,
                          deleted: false,
                        },
                      }}
                      statuses={statuses}
                      categories={categories}
                      adminView={true}
                      viewer={{
                        signedIn: true,
                        voted: false,
                        isAuthor: false,
                        isAdmin: true,
                        inConversation: false,
                        muted: false,
                        commentEmailsOn: false,
                        canEdit: true,
                        canDelete: true,
                      }}
                      variant="dashboard"
                      triggerIconOnly={true}
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <BulkMergeDialog
        open={bulkMergeOpen}
        onOpenChange={setBulkMergeOpen}
        ws={ws}
        product={product}
        posts={selectedPosts}
        onSuccess={() => setSelectedNumbers(new Set())}
      />
    </div>
  );
}
