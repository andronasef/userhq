import { z } from "zod";

export const ALLOWED_MARK_TYPES = [
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
] as const;

export const RichTextMarkSchema = z.object({
  type: z.enum(ALLOWED_MARK_TYPES),
  attrs: z
    .object({
      href: z
        .string()
        .refine(
          (url) => {
            try {
              const trimmed = url.trim().toLowerCase();
              if (
                trimmed.startsWith("javascript:") ||
                trimmed.startsWith("data:") ||
                trimmed.startsWith("vbscript:")
              ) {
                return false;
              }
              const parsed = new URL(url, "https://dummy.base");
              return ["http:", "https:", "mailto:"].includes(parsed.protocol);
            } catch {
              return false;
            }
          },
          { message: "Invalid link protocol" }
        )
        .optional(),
      target: z.string().optional(),
      rel: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const ALLOWED_NODE_TYPES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "text",
  "hardBreak",
] as const;

export type RichTextNode = {
  type: (typeof ALLOWED_NODE_TYPES)[number];
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: z.infer<typeof RichTextMarkSchema>[];
  text?: string;
};

export const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum(ALLOWED_NODE_TYPES),
    attrs: z
      .object({
        level: z.number().int().min(1).max(3).optional(),
        src: z
          .string()
          .refine(
            (url) => {
              try {
                const parsed = new URL(url);
                return ["http:", "https:"].includes(parsed.protocol);
              } catch {
                return false;
              }
            },
            { message: "Images must use http or https URLs" }
          )
          .optional(),
        alt: z.string().max(200).optional(),
        title: z.string().max(200).optional(),
      })
      .passthrough()
      .optional(),
    content: z.array(RichTextNodeSchema).optional(),
    marks: z.array(RichTextMarkSchema).optional(),
    text: z.string().optional(),
  })
);

export const RichTextDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(RichTextNodeSchema).default([]),
});

export type RichTextDoc = z.infer<typeof RichTextDocSchema>;
