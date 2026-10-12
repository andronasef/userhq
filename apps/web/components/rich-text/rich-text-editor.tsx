"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { RichTextDoc } from "@userhq/types";
import { EditorToolbar } from "./editor-toolbar";
import { cn } from "../../lib/utils";

export interface RichTextEditorProps {
  initialContent?: RichTextDoc | null;
  onChange?: (doc: RichTextDoc) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  initialContent,
  onChange,
  disabled = false,
  className,
}: RichTextEditorProps): React.JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            class: "text-primary underline hover:opacity-80 transition-opacity",
          },
        },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: "rounded-lg border border-border max-w-full h-auto my-4",
        },
      }),
    ],
    content: initialContent ?? { type: "doc", content: [] },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as RichTextDoc);
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[280px] p-4 border-x border-b border-border rounded-b-lg focus:outline-none bg-background text-base leading-relaxed text-foreground",
          className
        ),
      },
    },
  });

  React.useEffect(() => {
    if (editor && editor.isEditable === disabled) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="min-h-[280px] border border-border rounded-lg bg-muted/20 animate-pulse" />
    );
  }

  return (
    <div className="flex flex-col border border-border rounded-lg bg-background shadow-xs">
      <EditorToolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}
