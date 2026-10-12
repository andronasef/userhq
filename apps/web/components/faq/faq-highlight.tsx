import * as React from "react";

export interface HighlightTextProps {
  text: string;
  query: string;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightText({ text, query }: HighlightTextProps): React.JSX.Element {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return <>{text}</>;
  }

  const escaped = escapeRegex(trimmed);
  const splitRegex = new RegExp(`(${escaped})`, "gi");
  const testRegex = new RegExp(`^${escaped}$`, "i");
  const parts = text.split(splitRegex);

  return (
    <>
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary font-medium px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
