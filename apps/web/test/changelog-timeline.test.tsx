import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangelogTimelineItem, getChangelogTagClasses } from "../components/changelog/changelog-timeline-item";
import { ChangelogFeed } from "../components/changelog/changelog-feed";
import { ChangelogArticle } from "../components/changelog/changelog-article";
import type { PublicChangelogEntry } from "@userhq/types";

describe("Changelog Timeline & Article Components", () => {
  const mockEntry: PublicChangelogEntry = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Version 2.0 Release",
    slug: "version-2-0-release",
    summary: "Massive update with many new features and bug fixes.",
    publishedAt: "2026-10-12T10:00:00.000Z",
    createdAt: "2026-10-12T09:00:00.000Z",
    tags: [
      { id: "tag-1", name: "New", color: "#10B981" },
      { id: "tag-2", name: "Improved", color: "#3B82F6" },
      { id: "tag-3", name: "Fixed", color: "#F59E0B" },
      { id: "tag-4", name: "Security", color: "#64748B" },
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is a detailed changelog description with multiple paragraphs of content that exceeds the preview threshold. We have added many capabilities to the platform including faster builds, better dashboards, and refined interaction contracts.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Second paragraph detailing the architectural improvements and performance gains across all public portal pages and member workspaces.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Third paragraph ensuring that content is definitively collapsible and triggers the inline expansion toggle.",
            },
          ],
        },
      ],
    },
  };

  it("renders empty state when changelog feed has no entries", () => {
    const html = renderToStaticMarkup(
      <ChangelogFeed
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        entries={[]}
      />
    );

    expect(html).toContain("No updates published yet");
    expect(html).toContain(
      "Check back soon for announcements, new features, and improvements."
    );
  });

  it("renders timeline feed with vertical line connector track when entries exist", () => {
    const html = renderToStaticMarkup(
      <ChangelogFeed
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        entries={[mockEntry]}
      />
    );

    expect(html).toContain("border-l border-border");
    expect(html).toContain("Version 2.0 Release");
    expect(html).toContain('href="/acme-ws/roadmaps/changelog/version-2-0-release"');
  });

  it("renders timeline item with circular connector node and formatted date", () => {
    const html = renderToStaticMarkup(
      <ChangelogTimelineItem
        entry={mockEntry}
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
      />
    );

    // Timeline connector node
    expect(html).toContain(
      "absolute -left-[9px] top-1.5 size-4 rounded-full bg-background border-2 border-primary ring-4 ring-background"
    );

    // Formatted date
    expect(html).toContain("2026");
    expect(html).toContain("<time");
  });

  it("renders tag pills with semantic color classes per D-04", () => {
    expect(getChangelogTagClasses("New")).toContain("bg-emerald-500/10");
    expect(getChangelogTagClasses("new")).toContain("text-emerald-700");

    expect(getChangelogTagClasses("Improved")).toContain("bg-blue-500/10");
    expect(getChangelogTagClasses("improved")).toContain("text-blue-700");

    expect(getChangelogTagClasses("Fixed")).toContain("bg-amber-500/10");
    expect(getChangelogTagClasses("fixed")).toContain("text-amber-700");

    expect(getChangelogTagClasses("Security")).toContain("bg-slate-500/10");
    expect(getChangelogTagClasses("custom-tag")).toContain("text-slate-700");

    const html = renderToStaticMarkup(
      <ChangelogTimelineItem
        entry={mockEntry}
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
      />
    );

    expect(html).toContain("bg-emerald-500/10");
    expect(html).toContain("bg-blue-500/10");
    expect(html).toContain("bg-amber-500/10");
    expect(html).toContain("bg-slate-500/10");
  });

  it("toggles inline expansion between 'Read more ↓' and 'Show less ↑' (D-02)", () => {
    // Collapsed state
    const collapsedHtml = renderToStaticMarkup(
      <ChangelogTimelineItem
        entry={mockEntry}
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        defaultExpanded={false}
      />
    );
    expect(collapsedHtml).toContain("Read more ↓");
    expect(collapsedHtml).toContain("mask-fade-bottom");
    expect(collapsedHtml).not.toContain("Show less ↑");

    // Expanded state
    const expandedHtml = renderToStaticMarkup(
      <ChangelogTimelineItem
        entry={mockEntry}
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        defaultExpanded={true}
      />
    );
    expect(expandedHtml).toContain("Show less ↑");
    expect(expandedHtml).not.toContain("mask-fade-bottom");
  });

  it("renders product brand attribution in timeline item and NEVER author personal identity (D-14)", () => {
    const html = renderToStaticMarkup(
      <ChangelogTimelineItem
        entry={mockEntry}
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        productLogoUrl="https://example.com/logo.png"
      />
    );

    expect(html).toContain("Published by Roadmaps");
    expect(html).not.toContain("John Doe");
    expect(html).not.toContain("author");
  });

  it("renders standalone article reader with breadcrumb back link and brand header (D-03)", () => {
    const html = renderToStaticMarkup(
      <ChangelogArticle
        ws="acme-ws"
        product="roadmaps"
        productName="Roadmaps"
        entry={mockEntry}
      />
    );

    expect(html).toContain("← All updates");
    expect(html).toContain('href="/acme-ws/roadmaps/changelog"');
    expect(html).toContain("Roadmaps team");
    expect(html).toContain("Version 2.0 Release");
    expect(html).toContain("← Back to changelog");
  });
});
