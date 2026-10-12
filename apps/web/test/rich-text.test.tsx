import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { RichTextViewer } from "../components/rich-text/rich-text-viewer";
import type { RichTextDoc } from "@userhq/types";

describe("RichTextViewer", () => {
  it("renders null when given null, undefined, or empty doc", () => {
    expect(RichTextViewer({ content: null })).toBeNull();
    expect(RichTextViewer({ content: undefined })).toBeNull();
    expect(RichTextViewer({ content: { type: "doc", content: [] } })).toBeNull();
  });

  it("renders paragraphs, headings (H1-H3), bullet lists, and ordered lists as semantic elements", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Top Title" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section Heading" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sub-Section Heading" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Here is a paragraph with " },
            { type: "text", text: "bold text", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic text", marks: [{ type: "italic" }] },
            { type: "text", text: " and " },
            { type: "text", text: "inline code", marks: [{ type: "code" }] },
            { type: "text", text: " and " },
            { type: "text", text: "strike text", marks: [{ type: "strike" }] },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Bullet item 1" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Ordered item 1" }],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Wise words" }],
            },
          ],
        },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const answer = 42;" }],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichTextViewer content={doc} />);

    expect(html).toContain("<h1>Top Title</h1>");
    expect(html).toContain("<h2>Section Heading</h2>");
    expect(html).toContain("<h3>Sub-Section Heading</h3>");
    expect(html).toContain("<p>Here is a paragraph with <strong>bold text</strong> and <em>italic text</em> and <code>inline code</code> and <s>strike text</s></p>");
    expect(html).toContain("<ul><li><p>Bullet item 1</p></li></ul>");
    expect(html).toContain("<ol><li><p>Ordered item 1</p></li></ol>");
    expect(html).toContain("<blockquote><p>Wise words</p></blockquote>");
    expect(html).toContain("<pre><code>const answer = 42;</code></pre>");
  });

  it("renders links with target='_blank' and rel='noopener noreferrer nofollow'", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Check out UserHQ",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://userhq.io" },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(<RichTextViewer content={doc} />);

    expect(html).toContain('href="https://userhq.io"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("renders images with responsive rounded border styling, src, and alt", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://images.example.com/demo.png",
            alt: "Demo Screenshot",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<RichTextViewer content={doc} />);

    expect(html).toContain('src="https://images.example.com/demo.png"');
    expect(html).toContain('alt="Demo Screenshot"');
    expect(html).toContain("rounded-lg");
    expect(html).toContain("border");
    expect(html).toContain("max-w-full");
    expect(html).toContain("h-auto");
  });

  it("guarantees zero dangerouslySetInnerHTML in viewer implementation", () => {
    const filePath = resolve(__dirname, "../components/rich-text/rich-text-viewer.tsx");
    const fileSource = readFileSync(filePath, "utf-8");

    expect(fileSource).not.toContain("dangerouslySetInnerHTML");
    expect(fileSource).not.toContain("innerHTML");
  });

  it("guarantees RichTextEditor source uses immediatelyRender: false", () => {
    const filePath = resolve(__dirname, "../components/rich-text/rich-text-editor.tsx");
    const fileSource = readFileSync(filePath, "utf-8");

    expect(fileSource).toContain("immediatelyRender: false");
    expect(fileSource).toContain('"use client"');
  });
});
