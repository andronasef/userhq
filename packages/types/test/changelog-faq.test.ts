import { describe, it, expect } from "vitest";
import {
  RichTextDocSchema,
  ChangelogTitleSchema,
  ChangelogSlugSchema,
  ChangelogTagSchema,
  ChangelogTagInputSchema,
  AdminChangelogEntrySchema,
  PublicChangelogFeedResponseSchema,
  SEEDED_CHANGELOG_TAGS,
  FaqCategoryInputSchema,
  MoveFaqCategoryInputSchema,
  FaqQuestionInputSchema,
  UpdateFaqQuestionInputSchema,
  MoveFaqQuestionInputSchema,
  AdminFaqResponseSchema,
  PublicFaqResponseSchema,
  API_ERROR_CODES,
  type RichTextDoc,
} from "../src/index.js";

describe("RichTextDocSchema", () => {
  it("accepts a valid rich text ProseMirror doc with allowed nodes and marks", () => {
    const validDoc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Release 2.0" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "We are thrilled to announce ",
            },
            {
              type: "text",
              marks: [{ type: "bold" }, { type: "italic" }],
              text: "our biggest update",
            },
            {
              type: "text",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com/changelog" },
                },
              ],
              text: " click here",
            },
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
                  content: [{ type: "text", text: "Item 1" }],
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
              content: [{ type: "text", text: "A wise quote" }],
            },
          ],
        },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "console.log('hello');" }],
        },
        {
          type: "horizontalRule",
        },
        {
          type: "image",
          attrs: {
            src: "https://cdn.example.com/images/screenshot.png",
            alt: "Screenshot",
            title: "Dashboard Screenshot",
          },
        },
      ],
    };

    const res = RichTextDocSchema.safeParse(validDoc);
    expect(res.success).toBe(true);
  });

  it("accepts an empty doc structure", () => {
    const res = RichTextDocSchema.safeParse({ type: "doc", content: [] });
    expect(res.success).toBe(true);
  });

  it("rejects malicious links with javascript: protocol", () => {
    const maliciousDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [
                {
                  type: "link",
                  attrs: { href: "javascript:alert(document.cookie)" },
                },
              ],
              text: "malicious link",
            },
          ],
        },
      ],
    };

    const res = RichTextDocSchema.safeParse(maliciousDoc);
    expect(res.success).toBe(false);
  });

  it("rejects links with data: and vbscript: protocols", () => {
    const dataLinkDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [
                {
                  type: "link",
                  attrs: { href: "data:text/html,<script>alert(1)</script>" },
                },
              ],
              text: "data link",
            },
          ],
        },
      ],
    };

    const res = RichTextDocSchema.safeParse(dataLinkDoc);
    expect(res.success).toBe(false);
  });

  it("rejects images with data: URLs or non-http/https protocols", () => {
    const dataImageDoc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            alt: "Inline Base64",
          },
        },
      ],
    };

    const resData = RichTextDocSchema.safeParse(dataImageDoc);
    expect(resData.success).toBe(false);

    const relativeImageDoc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/images/local.png",
          },
        },
      ],
    };

    const resRelative = RichTextDocSchema.safeParse(relativeImageDoc);
    expect(resRelative.success).toBe(false);
  });

  it("rejects disallowed node types", () => {
    const scriptDoc = {
      type: "doc",
      content: [
        {
          type: "script",
          content: [{ type: "text", text: "alert(1)" }],
        },
      ],
    };

    const res = RichTextDocSchema.safeParse(scriptDoc);
    expect(res.success).toBe(false);
  });

  it("rejects heading levels outside 1-3", () => {
    const h4Doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 4 },
          content: [{ type: "text", text: "Level 4" }],
        },
      ],
    };

    const res = RichTextDocSchema.safeParse(h4Doc);
    expect(res.success).toBe(false);
  });
});

describe("Changelog validation schemas", () => {
  it("validates ChangelogTitleSchema with trimming and length rules", () => {
    // Valid title
    const valid = ChangelogTitleSchema.safeParse("  Exciting New Features  ");
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toBe("Exciting New Features");
    }

    // Required when empty or spaces
    const empty = ChangelogTitleSchema.safeParse("   ");
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe("title_required");
    }

    // Too short (< 3)
    const tooShort = ChangelogTitleSchema.safeParse("ab");
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      expect(tooShort.error.issues[0]?.message).toBe("title_length");
    }

    // Too long (> 150)
    const tooLong = ChangelogTitleSchema.safeParse("a".repeat(151));
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]?.message).toBe("title_length");
    }
  });

  it("validates ChangelogSlugSchema with formatting rules", () => {
    // Valid slugs
    const valid1 = ChangelogSlugSchema.safeParse("v1-0-release");
    expect(valid1.success).toBe(true);
    if (valid1.success) {
      expect(valid1.data).toBe("v1-0-release");
    }

    const valid2 = ChangelogSlugSchema.safeParse("  UPPER-case-slug  ");
    expect(valid2.success).toBe(true);
    if (valid2.success) {
      expect(valid2.data).toBe("upper-case-slug");
    }

    // Empty
    const empty = ChangelogSlugSchema.safeParse("");
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe("slug_required");
    }

    // Invalid formats (spaces, special chars, double hyphens)
    const invalidChars = ChangelogSlugSchema.safeParse("invalid slug!");
    expect(invalidChars.success).toBe(false);
    if (!invalidChars.success) {
      expect(invalidChars.error.issues[0]?.message).toBe("slug_format");
    }

    const doubleHyphen = ChangelogSlugSchema.safeParse("slug--with--double");
    expect(doubleHyphen.success).toBe(false);
    if (!doubleHyphen.success) {
      expect(doubleHyphen.error.issues[0]?.message).toBe("slug_format");
    }
  });

  it("contains SEEDED_CHANGELOG_TAGS with New, Improved, Fixed", () => {
    expect(SEEDED_CHANGELOG_TAGS).toHaveLength(3);
    const names = SEEDED_CHANGELOG_TAGS.map((t) => t.name);
    expect(names).toContain("New");
    expect(names).toContain("Improved");
    expect(names).toContain("Fixed");
  });

  it("validates ChangelogTagSchema and ChangelogTagInputSchema", () => {
    const validTag = ChangelogTagSchema.safeParse({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Security",
      color: "#10B981",
    });
    expect(validTag.success).toBe(true);

    const valid = ChangelogTagInputSchema.safeParse({
      name: "Security",
      color: "#10B981",
    });
    expect(valid.success).toBe(true);

    const invalidColor = ChangelogTagInputSchema.safeParse({
      name: "Security",
      color: "red",
    });
    expect(invalidColor.success).toBe(false);
  });

  it("parses valid AdminChangelogEntrySchema payload", () => {
    const entry = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Launch v2.0",
      slug: "launch-v2-0",
      summary: "Summary excerpt",
      content: { type: "doc", content: [] },
      publishedAt: "2026-10-12T12:00:00.000Z",
      tags: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "New",
          color: "#10B981",
        },
      ],
      createdAt: "2026-10-12T12:00:00.000Z",
      updatedAt: "2026-10-12T12:00:00.000Z",
    };

    const res = AdminChangelogEntrySchema.safeParse(entry);
    expect(res.success).toBe(true);
  });

  it("parses valid PublicChangelogFeedResponseSchema payload", () => {
    const feed = {
      entries: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Launch v2.0",
          slug: "launch-v2-0",
          summary: "Summary excerpt",
          content: { type: "doc", content: [] },
          publishedAt: "2026-10-12T12:00:00.000Z",
          tags: [],
          createdAt: "2026-10-12T12:00:00.000Z",
        },
      ],
      nextCursor: null,
    };

    const res = PublicChangelogFeedResponseSchema.safeParse(feed);
    expect(res.success).toBe(true);
  });
});

describe("FAQ validation schemas", () => {
  it("validates FaqCategoryInputSchema name length and requiredness", () => {
    const valid = FaqCategoryInputSchema.safeParse({ name: "Billing" });
    expect(valid.success).toBe(true);

    // Empty name
    const empty = FaqCategoryInputSchema.safeParse({ name: "   " });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe("category_name_required");
    }

    // Too short (< 2)
    const short = FaqCategoryInputSchema.safeParse({ name: "A" });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0]?.message).toBe("category_name_required");
    }

    // Too long (> 50)
    const long = FaqCategoryInputSchema.safeParse({ name: "A".repeat(51) });
    expect(long.success).toBe(false);
    if (!long.success) {
      expect(long.error.issues[0]?.message).toBe("category_name_too_long");
    }
  });

  it("validates FaqQuestionInputSchema and UpdateFaqQuestionInputSchema", () => {
    const valid = FaqQuestionInputSchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      question: "How do I upgrade my team subscription?",
      answer: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Go to settings and click billing." }],
          },
        ],
      },
    });
    expect(valid.success).toBe(true);

    const updateValid = UpdateFaqQuestionInputSchema.safeParse({
      question: "How do I upgrade my entire enterprise team?",
    });
    expect(updateValid.success).toBe(true);

    // Question too short (< 5)
    const shortQ = FaqQuestionInputSchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      question: "Why?",
      answer: { type: "doc", content: [] },
    });
    expect(shortQ.success).toBe(false);
    if (!shortQ.success) {
      expect(shortQ.error.issues[0]?.message).toBe("title_length");
    }

    // Question empty
    const emptyQ = FaqQuestionInputSchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      question: "    ",
      answer: { type: "doc", content: [] },
    });
    expect(emptyQ.success).toBe(false);
    if (!emptyQ.success) {
      expect(emptyQ.error.issues[0]?.message).toBe("title_required");
    }
  });

  it("parses valid MoveFaqCategoryInputSchema and MoveFaqQuestionInputSchema", () => {
    const moveCat = MoveFaqCategoryInputSchema.safeParse({ targetRank: "a0V" });
    expect(moveCat.success).toBe(true);

    const moveQ = MoveFaqQuestionInputSchema.safeParse({
      targetRank: "a1",
      targetCategoryId: "22222222-2222-4222-8222-222222222222",
    });
    expect(moveQ.success).toBe(true);
  });

  it("parses AdminFaqResponseSchema and PublicFaqResponseSchema", () => {
    const adminTree = {
      categories: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "General",
          rank: "a0",
          questions: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              categoryId: "11111111-1111-4111-8111-111111111111",
              question: "What is UserHQ?",
              answer: { type: "doc", content: [] },
              rank: "a0",
              createdAt: "2026-10-12T12:00:00.000Z",
              updatedAt: "2026-10-12T12:00:00.000Z",
            },
          ],
          createdAt: "2026-10-12T12:00:00.000Z",
          updatedAt: "2026-10-12T12:00:00.000Z",
        },
      ],
    };

    expect(AdminFaqResponseSchema.safeParse(adminTree).success).toBe(true);

    const publicTree = {
      categories: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "General",
          questions: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              question: "What is UserHQ?",
              answer: { type: "doc", content: [] },
            },
          ],
        },
      ],
    };

    expect(PublicFaqResponseSchema.safeParse(publicTree).success).toBe(true);
  });
});

describe("API_ERROR_CODES", () => {
  it("contains all required Phase 5 error codes", () => {
    const requiredCodes = [
      "title_required",
      "title_length",
      "slug_required",
      "slug_format",
      "slug_conflict",
      "content_required",
      "invalid_image_url",
      "category_name_required",
      "category_not_found",
      "reorder_failed",
    ] as const;

    for (const code of requiredCodes) {
      expect(API_ERROR_CODES).toContain(code);
    }
  });
});
