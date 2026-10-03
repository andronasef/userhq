export type LinkifySegment =
  | { kind: "text"; value: string }
  | { kind: "link"; href: string; value: string };

const URL_REGEX = /https?:\/\/[^\s]+/g;
const TRAILING_PUNCT = /[.,;:!?)]+$/;

export function linkify(text: string): LinkifySegment[] {
  if (!text) return [];

  const segments: LinkifySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const matchIndex = match.index;
    const fullMatch = match[0];

    if (matchIndex > lastIndex) {
      segments.push({
        kind: "text",
        value: text.slice(lastIndex, matchIndex),
      });
    }

    const punctMatch = fullMatch.match(TRAILING_PUNCT);
    const trailingPunct = punctMatch ? punctMatch[0] : "";
    const cleanUrl = fullMatch.slice(0, fullMatch.length - trailingPunct.length);

    if (
      cleanUrl.length > 0 &&
      (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) &&
      cleanUrl !== "http://" &&
      cleanUrl !== "https://"
    ) {
      segments.push({
        kind: "link",
        href: cleanUrl,
        value: cleanUrl,
      });
      if (trailingPunct.length > 0) {
        segments.push({
          kind: "text",
          value: trailingPunct,
        });
      }
    } else {
      segments.push({
        kind: "text",
        value: fullMatch,
      });
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      kind: "text",
      value: text.slice(lastIndex),
    });
  }

  const merged: LinkifySegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === "text" && seg.kind === "text") {
      prev.value += seg.value;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}
