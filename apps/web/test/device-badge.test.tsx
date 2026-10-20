import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { DeviceBadge } from "../components/post/device-badge";
import { AuthorLine } from "../components/post/author-line";

describe("DeviceBadge", () => {
  it("renders null when deviceInfo is null, undefined, or empty", () => {
    expect(renderToString(<DeviceBadge deviceInfo={null} />)).toBe("");
    expect(renderToString(<DeviceBadge deviceInfo={undefined} />)).toBe("");
    expect(
      renderToString(
        <DeviceBadge deviceInfo={{ browser: null, os: null, device: null }} />
      )
    ).toBe("");
  });

  it("renders device info with browser and OS", () => {
    const html = renderToString(
      <DeviceBadge
        deviceInfo={{
          browser: "Chrome 128",
          os: "macOS",
          device: "Desktop",
        }}
      />
    );
    expect(html).toContain("macOS · Chrome 128");
    expect(html).toContain("title=\"Desktop • macOS • Chrome 128\"");
  });

  it("renders mobile device info", () => {
    const html = renderToString(
      <DeviceBadge
        deviceInfo={{
          browser: "Safari 17",
          os: "iOS",
          device: "Mobile",
        }}
      />
    );
    expect(html).toContain("iOS · Safari 17");
  });

  it("renders gracefully in AuthorLine when present", () => {
    const html = renderToString(
      <AuthorLine
        author={{
          name: "Alice",
          image: null,
          deleted: false,
          isAdmin: false,
        }}
        createdAt="2026-10-20T10:00:00Z"
        deviceInfo={{
          browser: "Firefox 130",
          os: "Linux",
          device: "Desktop",
        }}
      />
    );
    expect(html).toContain("Alice");
    expect(html).toContain("Linux · Firefox 130");
  });

  it("renders gracefully in AuthorLine when deviceInfo is null", () => {
    const html = renderToString(
      <AuthorLine
        author={{
          name: "Bob",
          image: null,
          deleted: false,
          isAdmin: false,
        }}
        createdAt="2026-10-20T10:00:00Z"
        deviceInfo={null}
      />
    );
    expect(html).toContain("Bob");
    expect(html).not.toContain("· Firefox");
  });
});
