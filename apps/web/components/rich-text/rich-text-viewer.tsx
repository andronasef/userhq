import * as React from "react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { RichTextDoc } from "@userhq/types";
import { cn } from "../../lib/utils";

export interface RichTextViewerProps {
  content: RichTextDoc | null | undefined;
  className?: string;
}

export function RichTextViewer({
  content,
  className,
}: RichTextViewerProps): React.JSX.Element | null {
  if (!content || !content.content || content.content.length === 0) {
    return null;
  }

  const rendered = renderToReactElement({
    content,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
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
  });

  return (
    <div
      className={cn(
        "rich-text-content space-y-3 leading-relaxed text-foreground",
        className
      )}
    >
      {rendered}
    </div>
  );
}
