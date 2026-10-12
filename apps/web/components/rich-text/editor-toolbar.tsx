"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

export interface EditorToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  className?: string;
}

export function EditorToolbar({
  editor,
  disabled = false,
  className,
}: EditorToolbarProps): React.JSX.Element {
  // Image dialog state
  const [isImageOpen, setIsImageOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState("");
  const [imageAlt, setImageAlt] = React.useState("");
  const [imageError, setImageError] = React.useState<string | null>(null);

  // Link dialog state
  const [isLinkOpen, setIsLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const handleOpenImageDialog = () => {
    setImageUrl("");
    setImageAlt("");
    setImageError(null);
    setIsImageOpen(true);
  };

  const handleInsertImage = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      setImageError("Please enter an image URL.");
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setImageError("Please enter a valid http:// or https:// image URL.");
        return;
      }
    } catch {
      setImageError("Please enter a valid http:// or https:// image URL.");
      return;
    }

    if (imageAlt.trim().length > 200) {
      setImageError("Alt text must be 200 characters or less.");
      return;
    }

    if (editor) {
      editor
        .chain()
        .focus()
        .setImage({
          src: trimmed,
          alt: imageAlt.trim() || undefined,
        })
        .run();
    }

    setIsImageOpen(false);
    setImageUrl("");
    setImageAlt("");
    setImageError(null);
  };

  const handleOpenLinkDialog = () => {
    if (!editor) return;
    const currentHref = (editor.getAttributes("link").href as string) ?? "";
    setLinkUrl(currentHref);
    setLinkError(null);
    setIsLinkOpen(true);
  };

  const handleApplyLink = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editor) return;

    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setIsLinkOpen(false);
      return;
    }

    try {
      const parsed = new URL(trimmed, "https://dummy.base");
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
        setLinkError("URL must start with http://, https://, or mailto:");
        return;
      }
    } catch {
      setLinkError("Please enter a valid URL.");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    setIsLinkOpen(false);
    setLinkUrl("");
    setLinkError(null);
  };

  const handleRemoveLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkOpen(false);
    setLinkUrl("");
    setLinkError(null);
  };

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-10 bg-background border-b border-border p-1.5 flex flex-wrap items-center gap-1 shadow-2xs rounded-t-lg",
          className
        )}
        role="toolbar"
        aria-label="Text formatting"
      >
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled || !editor}
          title="Heading 2 (##)"
          aria-label="Heading 2"
          data-active={editor?.isActive("heading", { level: 2 })}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("heading", { level: 2 }) && "bg-muted text-foreground font-semibold"
          )}
        >
          <Heading2 className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled || !editor}
          title="Heading 3 (###)"
          aria-label="Heading 3"
          data-active={editor?.isActive("heading", { level: 3 })}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("heading", { level: 3 }) && "bg-muted text-foreground font-semibold"
          )}
        >
          <Heading3 className="size-4" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5 self-center" aria-hidden="true" />

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={disabled || !editor}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          data-active={editor?.isActive("bold")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("bold") && "bg-muted text-foreground font-semibold"
          )}
        >
          <Bold className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={disabled || !editor}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          data-active={editor?.isActive("italic")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("italic") && "bg-muted text-foreground font-semibold"
          )}
        >
          <Italic className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={disabled || !editor}
          title="Strikethrough"
          aria-label="Strikethrough"
          data-active={editor?.isActive("strike")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("strike") && "bg-muted text-foreground font-semibold"
          )}
        >
          <Strikethrough className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          disabled={disabled || !editor}
          title="Code block (```)"
          aria-label="Code block"
          data-active={editor?.isActive("codeBlock")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("codeBlock") && "bg-muted text-foreground font-semibold"
          )}
        >
          <Code className="size-4" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5 self-center" aria-hidden="true" />

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={disabled || !editor}
          title="Bullet list (- )"
          aria-label="Bullet list"
          data-active={editor?.isActive("bulletList")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("bulletList") && "bg-muted text-foreground font-semibold"
          )}
        >
          <List className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={disabled || !editor}
          title="Numbered list (1. )"
          aria-label="Numbered list"
          data-active={editor?.isActive("orderedList")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("orderedList") && "bg-muted text-foreground font-semibold"
          )}
        >
          <ListOrdered className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={disabled || !editor}
          title="Quote (> )"
          aria-label="Quote"
          data-active={editor?.isActive("blockquote")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("blockquote") && "bg-muted text-foreground font-semibold"
          )}
        >
          <Quote className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={disabled || !editor}
          title="Divider (---)"
          aria-label="Divider"
          className="size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <Minus className="size-4" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5 self-center" aria-hidden="true" />

        <button
          type="button"
          onClick={handleOpenLinkDialog}
          disabled={disabled || !editor}
          title="Insert link"
          aria-label="Insert link"
          data-active={editor?.isActive("link")}
          className={cn(
            "size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            editor?.isActive("link") && "bg-muted text-foreground font-semibold"
          )}
        >
          <LinkIcon className="size-4" />
        </button>

        <button
          type="button"
          onClick={handleOpenImageDialog}
          disabled={disabled || !editor}
          title="Insert remote image (URL)"
          aria-label="Insert remote image"
          className="size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <ImageIcon className="size-4" />
        </button>
      </div>

      {/* Remote Image Dialog */}
      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent>
          <form onSubmit={handleInsertImage} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Insert remote image</DialogTitle>
              <DialogDescription>
                Provide a direct link to an image hosted on http:// or https://. Local file uploads are not supported.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="image-url-input" className="text-xs font-semibold text-foreground">
                  Image URL <span className="text-destructive">*</span>
                </label>
                <Input
                  id="image-url-input"
                  type="url"
                  placeholder="https://example.com/screenshot.png"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (imageError) setImageError(null);
                  }}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="image-alt-input" className="text-xs font-semibold text-foreground">
                  Alt text <span className="text-xs font-normal text-muted-foreground">(optional, max 200 chars)</span>
                </label>
                <Input
                  id="image-alt-input"
                  type="text"
                  maxLength={200}
                  placeholder="Descriptive caption or alt text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                />
              </div>

              {imageError && (
                <p className="text-xs text-destructive" role="alert">
                  {imageError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImageOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Insert image
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent>
          <form onSubmit={handleApplyLink} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {editor?.isActive("link") ? "Edit link" : "Insert link"}
              </DialogTitle>
              <DialogDescription>
                Enter a destination URL (starting with http://, https://, or mailto:).
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="link-url-input" className="text-xs font-semibold text-foreground">
                Destination URL
              </label>
              <Input
                id="link-url-input"
                type="text"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                autoFocus
              />
              {linkError && (
                <p className="text-xs text-destructive" role="alert">
                  {linkError}
                </p>
              )}
            </div>

            <DialogFooter>
              {editor?.isActive("link") && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemoveLink}
                  className="sm:mr-auto"
                >
                  Remove link
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Save link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
