import type { RichTextDoc, RichTextNode } from "@userhq/types";

/** Empty paragraphs and nested list containers do not make an answer useful. */
export function hasRichTextContent(doc: RichTextDoc | null): boolean {
  const hasContent = (node: RichTextNode): boolean =>
    Boolean(node.text?.trim()) ||
    node.type === "image" ||
    Boolean(node.content?.some(hasContent));
  return Boolean(doc?.content.some(hasContent));
}
