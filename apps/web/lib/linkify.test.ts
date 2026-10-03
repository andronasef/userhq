import { describe, expect, it } from "vitest";
import { linkify } from "./linkify";

describe("linkify", () => {
  it("linkifies standard https and http URLs", () => {
    const input = "Visit https://userhq.com for details";
    expect(linkify(input)).toEqual([
      { kind: "text", value: "Visit " },
      { kind: "link", href: "https://userhq.com", value: "https://userhq.com" },
      { kind: "text", value: " for details" },
    ]);
  });

  it("excludes trailing punctuation from URLs", () => {
    const input = "Check https://example.com/x., and (https://example.com/y)!";
    expect(linkify(input)).toEqual([
      { kind: "text", value: "Check " },
      { kind: "link", href: "https://example.com/x", value: "https://example.com/x" },
      { kind: "text", value: "., and (" },
      { kind: "link", href: "https://example.com/y", value: "https://example.com/y" },
      { kind: "text", value: ")!" },
    ]);
  });

  it("leaves <script>alert(1)</script> as literal text", () => {
    const input = "<script>alert(1)</script>";
    expect(linkify(input)).toEqual([
      { kind: "text", value: "<script>alert(1)</script>" },
    ]);
  });

  it("leaves javascript: pseudo-protocols as literal text", () => {
    const input = "javascript:alert(1)";
    expect(linkify(input)).toEqual([
      { kind: "text", value: "javascript:alert(1)" },
    ]);
  });

  it("leaves markdown syntax as literal text", () => {
    const input = "**bold** and *italic* and [link](https://foo.bar)";
    expect(linkify(input)).toEqual([
      { kind: "text", value: "**bold** and *italic* and [link](" },
      { kind: "link", href: "https://foo.bar", value: "https://foo.bar" },
      { kind: "text", value: ")" },
    ]);
  });

  it("handles complex mixed input accurately", () => {
    const input =
      "<script>alert(1)</script> **bold** javascript:alert(1) https://example.com/x.";
    expect(linkify(input)).toEqual([
      {
        kind: "text",
        value: "<script>alert(1)</script> **bold** javascript:alert(1) ",
      },
      {
        kind: "link",
        href: "https://example.com/x",
        value: "https://example.com/x",
      },
      { kind: "text", value: "." },
    ]);
  });
});
