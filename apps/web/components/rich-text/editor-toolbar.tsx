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
import { useI18n } from "../../lib/i18n/context";

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
  const { t } = useI18n();
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
      setImageError(t("richText.enterImageUrl"));
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setImageError(t("richText.invalidImageUrl"));
        return;
      }
    } catch {
      setImageError(t("richText.invalidImageUrl"));
      return;
    }

    if (imageAlt.trim().length > 200) {
      setImageError(t("richText.altTextTooLong"));
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
        setLinkError(t("richText.invalidLinkProtocol"));
        return;
      }
    } catch {
      setLinkError(t("richText.invalidLinkUrl"));
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
        aria-label={t("richText.textFormatting")}
      >
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled || !editor}
          title={t("richText.heading2")}
          aria-label={t("richText.heading2")}
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
          title={t("richText.heading3")}
          aria-label={t("richText.heading3")}
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
          title={t("richText.bold")}
          aria-label={t("richText.bold")}
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
          title={t("richText.italic")}
          aria-label={t("richText.italic")}
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
          title={t("richText.strikethrough")}
          aria-label={t("richText.strikethrough")}
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
          title={t("richText.codeBlock")}
          aria-label={t("richText.codeBlock")}
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
          title={t("richText.bulletList")}
          aria-label={t("richText.bulletList")}
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
          title={t("richText.numberedList")}
          aria-label={t("richText.numberedList")}
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
          title={t("richText.quote")}
          aria-label={t("richText.quote")}
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
          title={t("richText.divider")}
          aria-label={t("richText.divider")}
          className="size-8 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <Minus className="size-4" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5 self-center" aria-hidden="true" />

        <button
          type="button"
          onClick={handleOpenLinkDialog}
          disabled={disabled || !editor}
          title={t("richText.insertLink")}
          aria-label={t("richText.insertLink")}
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
          title={t("richText.insertRemoteImage")}
          aria-label={t("richText.insertRemoteImage")}
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
              <DialogTitle>{t("richText.insertRemoteImage")}</DialogTitle>
              <DialogDescription>
                {t("richText.imageDialogDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="image-url-input" className="text-xs font-semibold text-foreground">
                  {t("richText.imageUrlLabel")} <span className="text-destructive">*</span>
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
                  {t("richText.altTextLabel")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("richText.altTextOptional")}
                  </span>
                </label>
                <Input
                  id="image-alt-input"
                  type="text"
                  maxLength={200}
                  placeholder={t("richText.altTextPlaceholder")}
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
                {t("common.cancel")}
              </Button>
              <Button type="submit">
                {t("richText.insertImage")}
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
                {editor?.isActive("link") ? t("richText.editLink") : t("richText.insertLink")}
              </DialogTitle>
              <DialogDescription>
                {t("richText.linkDialogDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="link-url-input" className="text-xs font-semibold text-foreground">
                {t("richText.destinationUrlLabel")}
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
                  {t("richText.removeLink")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit">
                {t("richText.saveLink")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
