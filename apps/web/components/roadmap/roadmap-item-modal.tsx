"use client";

import * as React from "react";
import { ChevronUp, LoaderCircle, Trash2, X, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  type AdminRoadmapItem,
  type Status,
  type MemberRow,
  type RoadmapPostLinkSearchResult,
  type RoadmapPostLinkSearchResponse,
  AdminRoadmapItemSchema,
  RoadmapPostLinkSearchResponseSchema,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { NativeSelect } from "../ui/native-select";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert } from "../ui/alert";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { PostLinkCombobox } from "./post-link-combobox";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface RoadmapItemModalProps {
  ws: string;
  product: string;
  item?: AdminRoadmapItem | null;
  statuses: Status[];
  members: MemberRow[];
  defaultStatusId?: string;
  prelinkedPost?: RoadmapPostLinkSearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: AdminRoadmapItem) => void;
  onDeleted?: (itemId: string) => void;
}

export function RoadmapItemModal({
  ws,
  product,
  item,
  statuses,
  members,
  defaultStatusId,
  prelinkedPost,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: RoadmapItemModalProps) {
  const isEdit = Boolean(item);

  const [linkedPosts, setLinkedPosts] = React.useState<RoadmapPostLinkSearchResult[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const initialStatusId =
    item?.statusId ?? defaultStatusId ?? statuses[0]?.id ?? "";

  const [isPublic, setIsPublic] = React.useState<boolean>(item?.isPublic ?? false);
  const [publicTitle, setPublicTitle] = React.useState<string>(
    item?.publicTitle ?? ""
  );
  const [publicDescription, setPublicDescription] = React.useState<string>(
    item?.publicDescription ?? ""
  );
  const [internalTitle, setInternalTitle] = React.useState<string>(
    item?.internalTitle ?? prelinkedPost?.title ?? ""
  );
  const [internalDescription, setInternalDescription] = React.useState<string>(
    item?.internalDescription ?? ""
  );
  const [internalNotes, setInternalNotes] = React.useState<string>(
    item?.internalNotes ?? ""
  );
  const [statusId, setStatusId] = React.useState<string>(initialStatusId);
  const [assigneeId, setAssigneeId] = React.useState<string>(
    item?.assignee?.id ?? ""
  );
  const [deadlineText, setDeadlineText] = React.useState<string>(
    item?.deadlineText ?? ""
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Reset form whenever modal opens or item changes
  React.useEffect(() => {
    if (!open) return;

    setAlertError(null);
    setErrors({});

    if (item) {
      setIsPublic(item.isPublic);
      setPublicTitle(item.publicTitle ?? "");
      setPublicDescription(item.publicDescription ?? "");
      setInternalTitle(item.internalTitle);
      setInternalDescription(item.internalDescription ?? "");
      setInternalNotes(item.internalNotes ?? "");
      setStatusId(item.statusId);
      setAssigneeId(item.assignee?.id ?? "");
      setDeadlineText(item.deadlineText ?? "");

      // Fetch linked posts for this item
      setIsLoadingPosts(true);
      apiFetch<RoadmapPostLinkSearchResponse>(
        `/api/v1/workspaces/${ws}/products/${product}/roadmap/${item.id}/posts`,
        { schema: RoadmapPostLinkSearchResponseSchema }
      )
        .then((res) => {
          setLinkedPosts(res.posts);
        })
        .catch(() => {
          setLinkedPosts([]);
        })
        .finally(() => {
          setIsLoadingPosts(false);
        });
    } else {
      setIsPublic(false);
      setPublicTitle("");
      setPublicDescription("");
      setInternalTitle(prelinkedPost?.title ?? "");
      setInternalDescription("");
      setInternalNotes("");
      setStatusId(defaultStatusId ?? statuses[0]?.id ?? "");
      setAssigneeId("");
      setDeadlineText("");

      if (prelinkedPost) {
        setLinkedPosts([prelinkedPost]);
      } else {
        setLinkedPosts([]);
      }
    }
  }, [open, item, prelinkedPost, defaultStatusId, statuses, ws, product]);

  const handleTogglePublic = (nextPublic: boolean) => {
    setIsPublic(nextPublic);
    if (nextPublic && !publicTitle.trim() && internalTitle.trim()) {
      setPublicTitle(internalTitle.trim());
    }
  };

  const handleLinkPost = async (post: RoadmapPostLinkSearchResult) => {
    if (linkedPosts.some((p) => p.id === post.id)) return;

    if (isEdit && item) {
      try {
        await apiFetch(
          `/api/v1/workspaces/${ws}/products/${product}/roadmap/${item.id}/link`,
          {
            method: "POST",
            body: { postId: post.id },
          }
        );
        setLinkedPosts((prev) => [...prev, post]);
        toast.success(`Linked #${post.number}`);
      } catch (err: unknown) {
        toast.error(errorCopy(err as any));
      }
    } else {
      setLinkedPosts((prev) => [...prev, post]);
    }
  };

  const handleUnlinkPost = async (postId: string) => {
    const post = linkedPosts.find((p) => p.id === postId);
    if (isEdit && item) {
      try {
        await apiFetch(
          `/api/v1/workspaces/${ws}/products/${product}/roadmap/${item.id}/unlink/${postId}`,
          { method: "DELETE" }
        );
        setLinkedPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success(`Unlinked #${post?.number ?? ""}`);
      } catch (err: unknown) {
        toast.error(errorCopy(err as any));
      }
    } else {
      setLinkedPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!internalTitle.trim()) {
      errs.internalTitle = "Enter an internal title.";
    } else if (
      internalTitle.trim().length < 3 ||
      internalTitle.trim().length > 120
    ) {
      errs.internalTitle =
        "Internal title must be between 3 and 120 characters.";
    }

    if (isPublic) {
      if (!publicTitle.trim()) {
        errs.publicTitle = "Enter a public title.";
      } else if (
        publicTitle.trim().length < 3 ||
        publicTitle.trim().length > 120
      ) {
        errs.publicTitle = "Public title must be between 3 and 120 characters.";
      }

      if (publicDescription.length > 5000) {
        errs.publicDescription = "Keep details under 5,000 characters.";
      }
    }

    if (internalNotes.length > 5000) {
      errs.internalNotes = "Keep notes under 5,000 characters.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setAlertError(null);

    const payload = {
      isPublic,
      publicTitle: isPublic ? publicTitle.trim() : null,
      publicDescription:
        isPublic && publicDescription.trim() ? publicDescription.trim() : null,
      internalTitle: internalTitle.trim(),
      internalDescription: internalDescription.trim()
        ? internalDescription.trim()
        : null,
      internalNotes: internalNotes.trim() ? internalNotes.trim() : null,
      statusId,
      assigneeId: assigneeId || null,
      deadlineText: deadlineText.trim() ? deadlineText.trim() : null,
      postIds: linkedPosts.map((p) => p.id),
    };

    try {
      if (isEdit && item) {
        const saved = await apiFetch<AdminRoadmapItem>(
          `/api/v1/workspaces/${ws}/products/${product}/roadmap/${item.id}`,
          {
            method: "PATCH",
            body: payload,
            schema: AdminRoadmapItemSchema,
          }
        );
        toast.success("Roadmap item updated");
        onSaved(saved);
        onOpenChange(false);
      } else {
        const created = await apiFetch<AdminRoadmapItem>(
          `/api/v1/workspaces/${ws}/products/${product}/roadmap`,
          {
            method: "POST",
            body: payload,
            schema: AdminRoadmapItemSchema,
          }
        );
        toast.success("Roadmap item created");
        onSaved(created);
        onOpenChange(false);
      }
    } catch (err: unknown) {
      setAlertError(errorCopy(err as any));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    try {
      await apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/roadmap/${item.id}`,
        { method: "DELETE" }
      );
      toast.success("Roadmap item deleted");
      if (onDeleted) onDeleted(item.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete item. Try again.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit roadmap item" : "New roadmap item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            <fieldset disabled={isSubmitting} className="space-y-6">
              {/* Make Public Switch */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isPublic ? (
                      <Globe className="size-4 text-primary" aria-hidden="true" />
                    ) : (
                      <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <label
                      htmlFor="modal-make-public"
                      className="text-sm font-semibold text-foreground cursor-pointer"
                    >
                      Make public
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When public, this item appears on your customer-facing roadmap in its status column.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="modal-make-public"
                  checked={isPublic}
                  onChange={(e) => handleTogglePublic(e.target.checked)}
                  className="size-5 rounded border-border text-primary focus:ring-ring mt-0.5 cursor-pointer"
                />
              </div>

              {/* Public Fields (conditional on isPublic) */}
              {isPublic && (
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Public Details (Customer Visible)
                  </h4>
                  <Field
                    id="modal-public-title"
                    label="Public title"
                    error={errors.publicTitle}
                    helper="Customer-facing title shown on the public roadmap."
                  >
                    <Input
                      id="modal-public-title"
                      value={publicTitle}
                      onChange={(e) => setPublicTitle(e.target.value)}
                      placeholder="e.g. Dark Mode Support"
                    />
                  </Field>

                  <Field
                    id="modal-public-description"
                    label="Public description"
                    error={errors.publicDescription}
                    helper="Optional description explaining what is being delivered and why."
                  >
                    <Textarea
                      id="modal-public-description"
                      value={publicDescription}
                      onChange={(e) => setPublicDescription(e.target.value)}
                      placeholder="Describe the feature value for your users…"
                      rows={3}
                    />
                  </Field>
                </div>
              )}

              {/* Internal Fields */}
              <div className="space-y-4">
                <Field
                  id="modal-internal-title"
                  label="Internal title"
                  error={errors.internalTitle}
                  helper="Internal working title for team planning (never shown publicly)."
                >
                  <Input
                    id="modal-internal-title"
                    value={internalTitle}
                    onChange={(e) => setInternalTitle(e.target.value)}
                    placeholder="e.g. Implement theme toggle with next-themes"
                  />
                </Field>

                <Field
                  id="modal-internal-description"
                  label="Internal description"
                  error={errors.internalDescription}
                  helper="Optional technical notes or scope specifications for the team."
                >
                  <Textarea
                    id="modal-internal-description"
                    value={internalDescription}
                    onChange={(e) => setInternalDescription(e.target.value)}
                    placeholder="Technical scope, architectural choices, or prerequisites…"
                    rows={3}
                  />
                </Field>

                <Field
                  id="modal-internal-notes"
                  label="Internal notes"
                  error={errors.internalNotes}
                  helper="Private scratchpad for notes and links."
                >
                  <Textarea
                    id="modal-internal-notes"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Add private links, customer quotes, or implementation notes…"
                    rows={2}
                  />
                </Field>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
                <Field id="modal-status" label="Status">
                  <NativeSelect
                    id="modal-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                  >
                    {statuses.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field id="modal-assignee" label="Assignee">
                  <NativeSelect
                    id="modal-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field
                  id="modal-deadline"
                  label="Target deadline"
                  helper="Quarter, month, or date."
                >
                  <Input
                    id="modal-deadline"
                    value={deadlineText}
                    onChange={(e) => setDeadlineText(e.target.value)}
                    placeholder="e.g. Q4 2026, Nov 2026"
                  />
                </Field>
              </div>

              {/* Linked Feedback Posts */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    Linked feedback posts
                  </label>
                  <Badge variant="neutral" className="tabular-nums">
                    {linkedPosts.length}
                  </Badge>
                </div>

                <PostLinkCombobox
                  ws={ws}
                  product={product}
                  statuses={statuses}
                  linkedPostIds={linkedPosts.map((p) => p.id)}
                  onSelectPost={handleLinkPost}
                />

                {isLoadingPosts ? (
                  <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin mr-2" />
                    Loading linked posts…
                  </div>
                ) : linkedPosts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
                    No feedback posts linked yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedPosts.map((post) => {
                      const postStatus = statuses.find((s) => s.id === post.statusId);
                      return (
                        <div
                          key={post.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-background"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              <ChevronUp className="size-3" aria-hidden="true" />
                              {post.voteCount}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">
                              #{post.number} {post.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {postStatus && (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0 h-5"
                              >
                                <span
                                  className="size-2 rounded-full mr-1.5 shrink-0"
                                  style={{ backgroundColor: postStatus.color }}
                                />
                                {postStatus.name}
                              </Badge>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUnlinkPost(post.id)}
                              className="size-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Unlink post #${post.number}`}
                            >
                              <X className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {alertError && <Alert variant="destructive">{alertError}</Alert>}

              {/* Dialog Footer */}
              <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t border-border">
                {isEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span>Delete item</span>
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Discard changes
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin mr-1.5" />
                        <span>Saving…</span>
                      </>
                    ) : isEdit ? (
                      "Save item"
                    ) : (
                      "Create item"
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete roadmap item?"
        description="This item will be permanently removed. Linked feedback posts will stay on the board, keep their current status, and be unlocked."
        dismissLabel="Cancel"
        confirmLabel="Delete item"
        pendingLabel="Deleting…"
        onConfirm={handleDelete}
      />
    </>
  );
}
