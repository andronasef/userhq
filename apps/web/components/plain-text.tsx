import * as React from "react";
import { cn } from "@/lib/utils";
import { linkify } from "@/lib/linkify";

export interface PlainTextProps {
  text: string;
  className?: string;
}

export function PlainText({ text, className }: PlainTextProps): React.JSX.Element {
  const segments = linkify(text);

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((seg, i) => {
        if (seg.kind === "link") {
          return (
            <a
              key={i}
              href={seg.href}
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="text-[var(--primary-text)] underline break-all"
            >
              {seg.value}
            </a>
          );
        }
        return <React.Fragment key={i}>{seg.value}</React.Fragment>;
      })}
    </p>
  );
}
