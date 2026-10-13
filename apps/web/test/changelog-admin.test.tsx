import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangelogStudio } from "../components/changelog/changelog-studio";
import { ChangelogEditor } from "../components/changelog/changelog-editor";
import { ChangelogTagDialog } from "../components/changelog/changelog-tag-dialog";
import { ChangelogPreviewModal } from "../components/changelog/changelog-preview-modal";
import type { AdminChangelogEntry, ChangelogTag } from "@userhq/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock @radix-ui/react-dialog so portal renders in static SSR environment
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Trigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  Title: ({ children, className }: any) => <div data-testid="dialog-title" className={className}>{children}</div>,
  Description: ({ children, className }: any) => <div data-testid="dialog-desc" className={className}>{children}</div>,
  Close: ({ children }: any) => <div data-testid="dialog-close">{children}</div>,
}));

describe("Changelog Admin Studio & Authoring Components", () => {
  const sampleTags: ChangelogTag[] = [
    { id: "tag-1", name: "New", color: "#10B981" },
    { id: "tag-2", name: "Improved", color: "#3B82F6" },
  ];

  const sampleEntry: AdminChangelogEntry = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Version 2.4 - Faster Exports & Analytics",
    slug: "version-2-4-faster-exports-analytics",
    summary: "A fast release note with analytics updates.",
    publishedAt: "2026-01-15T12:00:00.000Z",
    tags: sampleTags,
    createdAt: "2026-01-15T11:00:00.000Z",
    updatedAt: "2026-01-15T11:00:00.000Z",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Exciting updates to our data export engine." },
          ],
        },
      ],
    },
  };

  const draftEntry: AdminChangelogEntry = {
    ...sampleEntry,
    id: "22222222-2222-4222-8222-222222222222",
    title: "Upcoming Beta Features",
    slug: "upcoming-beta-features",
    publishedAt: null, // Draft
  };

  it("labels future-dated entries Scheduled, not Published", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const html = renderToStaticMarkup(
      <ChangelogStudio
        ws="acme"
        product="core"
        productName="Acme Core"
        entries={[{ ...sampleEntry, publishedAt: future }]}
        tags={sampleTags}
      />
    );

    expect(html).toContain("Scheduled");
    expect(html).not.toContain(">Published<");
  });

  it("renders EmptyState in ChangelogStudio when no entries exist", () => {
    const html = renderToStaticMarkup(
      <ChangelogStudio
        ws="acme"
        product="core"
        productName="Acme Core"
        entries={[]}
        tags={sampleTags}
      />
    );

    expect(html).toContain("No changelog entries yet");
    expect(html).toContain("New entry");
    expect(html).toContain("Manage tags");
  });

  it("renders table with entries, published and draft status badges", () => {
    const html = renderToStaticMarkup(
      <ChangelogStudio
        ws="acme"
        product="core"
        productName="Acme Core"
        entries={[sampleEntry, draftEntry]}
        tags={sampleTags}
      />
    );

    expect(html).toContain("Version 2.4 - Faster Exports &amp; Analytics");
    expect(html).toContain("/changelog/version-2-4-faster-exports-analytics");
    expect(html).toContain("Published");
    expect(html).toContain("Draft");
    expect(html).toContain("Unscheduled draft");
    expect(html).toContain("New");
    expect(html).toContain("Improved");
  });

  it("renders ChangelogEditor in create mode with empty fields and default tags", () => {
    const html = renderToStaticMarkup(
      <ChangelogEditor
        ws="acme"
        product="core"
        productName="Acme Core"
        availableTags={sampleTags}
      />
    );

    expect(html).toContain("New release note");
    expect(html).toContain("Draft");
    expect(html).toContain("/changelog/");
    expect(html).toContain("Save draft");
    expect(html).toContain("Publish");
    expect(html).toContain("Release Content");
  });

  it("renders ChangelogEditor in edit mode with pre-filled entry data", () => {
    const html = renderToStaticMarkup(
      <ChangelogEditor
        ws="acme"
        product="core"
        productName="Acme Core"
        entry={sampleEntry}
        availableTags={sampleTags}
      />
    );

    expect(html).toContain("Edit release note");
    expect(html).toContain("Published");
    expect(html).toContain("Update");
    expect(html).toContain("Unpublish");
    expect(html).toContain("Version 2.4 - Faster Exports &amp; Analytics");
    expect(html).toContain("version-2-4-faster-exports-analytics");
  });

  it("renders ChangelogTagDialog with current tags and color swatches", () => {
    const html = renderToStaticMarkup(
      <ChangelogTagDialog
        open={true}
        onOpenChange={() => {}}
        ws="acme"
        product="core"
        tags={sampleTags}
        onTagsChange={() => {}}
      />
    );

    expect(html).toContain("Manage tags");
    expect(html).toContain("Current tags (2)");
    expect(html).toContain("New");
    expect(html).toContain("Improved");
    expect(html).toContain("Add new tag");
  });

  it("renders ChangelogPreviewModal with exact public appearance", () => {
    const html = renderToStaticMarkup(
      <ChangelogPreviewModal
        open={true}
        onOpenChange={() => {}}
        ws="acme"
        product="core"
        productName="Acme Core"
        entry={sampleEntry}
      />
    );

    expect(html).toContain("Changelog Preview");
    expect(html).toContain("Version 2.4 - Faster Exports &amp; Analytics");
    expect(html).toContain("Acme Core team");
    expect(html).toContain("Exciting updates to our data export engine.");
  });
});
