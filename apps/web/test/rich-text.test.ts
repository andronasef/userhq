import { describe, expect, it } from "vitest";
import { hasRichTextContent } from "../lib/rich-text";

describe("FAQ answer content", () => {
  it("rejects a missing answer and an editor cleared to an empty paragraph", () => {
    expect(hasRichTextContent(null)).toBe(false);
    expect(hasRichTextContent({ type: "doc", content: [] })).toBe(false);
    expect(
      hasRichTextContent({ type: "doc", content: [{ type: "paragraph" }] }),
    ).toBe(false);
    expect(
      hasRichTextContent({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "  " }] },
        ],
      }),
    ).toBe(false);
    expect(
      hasRichTextContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts meaningful nested text and image-only answers", () => {
    expect(
      hasRichTextContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Open Settings." }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasRichTextContent({
        type: "doc",
        content: [{ type: "image", attrs: { src: "/uploads/help.webp" } }],
      }),
    ).toBe(true);
  });
});
