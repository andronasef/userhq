"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import type { PublicComment } from "@userhq/types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";

export interface CommentComposerProps {
  ws: string;
  product: string;
  postNumber: number;
  parentId?: string;
  mode?: "comment" | "reply";
  autoFocus?: boolean;
  initialDraft?: string;
  onDraftChange?: (draft: string) => void;
  onSuccess: (comment: PublicComment) => void;
  onCancel?: () => void;
}

export function CommentComposer({
  ws,
  product,
  postNumber,
  parentId,
  mode = "comment",
  autoFocus = false,
  initialDraft = "",
  onDraftChange,
  onSuccess,
  onCancel,
}: CommentComposerProps): React.JSX.Element {
  const [body, setBody] = React.useState(initialDraft);
  const [isPending, setIsPending] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    onDraftChange?.(val);
    if (fieldError) setFieldError(null);
    if (alertError) setAlertError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isPending) return;

    const trimmed = body.trim();
    if (!trimmed) {
      setFieldError("Write something before posting.");
      return;
    }
    if (trimmed.length > 5000) {
      setFieldError("Keep comments under 5,000 characters.");
      return;
    }

    setIsPending(true);
    setFieldError(null);
    setAlertError(null);

    try {
      const result = await apiFetch<PublicComment>(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts/${postNumber}/comments`,
        {
          method: "POST",
          body: {
            body: trimmed,
            ...(parentId ? { parentId } : {}),
          },
        }
      );

      setBody("");
      onDraftChange?.("");
      onSuccess(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "comment_required") {
          setFieldError("Write something before posting.");
        } else if (err.code === "comment_too_long") {
          setFieldError("Keep comments under 5,000 characters.");
        } else {
          setAlertError(errorCopy(err));
        }
      } else {
        setAlertError("Something went wrong on our end. Try again in a moment.");
      }
    } finally {
      setIsPending(false);
    }
  };

  const isReply = mode === "reply";
  const formId = isReply ? (parentId ? `comment-${parentId}` : undefined) : "comment";
  const labelText = isReply ? "Write a reply" : "Write a comment";
  const placeholder = isReply ? "Write a reply…" : "Add a comment…";
  const submitText = isReply ? "Post reply" : "Post comment";

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
      noValidate
    >
      <label htmlFor={formId ? `${formId}-body` : undefined} className="sr-only">
        {labelText}
      </label>
      <Textarea
        ref={textareaRef}
        id={formId ? `${formId}-body` : undefined}
        value={body}
        onChange={handleChange}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={isPending}
        rows={isReply ? 3 : 4}
        aria-invalid={fieldError ? "true" : undefined}
        aria-describedby={fieldError ? `${formId}-error` : undefined}
      />
      {fieldError && (
        <p
          id={`${formId}-error`}
          role="alert"
          className="text-xs text-destructive font-medium"
        >
          {fieldError}
        </p>
      )}
      {alertError && (
        <Alert variant="destructive">
          <p>{alertError}</p>
        </Alert>
      )}
      <div className="flex justify-end items-center gap-2">
        {isReply && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Discard reply
          </Button>
        )}
        <Button
          type="submit"
          variant="default"
          size={isReply ? "sm" : "default"}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              <span>Posting…</span>
            </>
          ) : (
            submitText
          )}
        </Button>
      </div>
    </form>
  );
}
