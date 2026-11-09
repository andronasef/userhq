import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { BadgeChip } from "../components/badges/badge-chip";
import { AuthorLine } from "../components/post/author-line";

describe("BadgeChip UI Component", () => {
  it("renders badge chip with custom colors, name, and icon", () => {
    const html = renderToString(
      <BadgeChip
        badge={{
          id: "b1",
          name: "VIP Patron",
          slug: "vip-patron",
          color: "#fef08a",
          textColor: "#854d0e",
          icon: "crown",
          priority: 50,
        }}
      />
    );

    expect(html).toContain("VIP Patron");
    expect(html).toContain("background-color:#fef08a");
    expect(html).toContain("color:#854d0e");
    expect(html).toContain("svg");
  });

  it("handles null icon and unknown icon without errors", () => {
    const htmlNoIcon = renderToString(
      <BadgeChip
        badge={{
          id: "b2",
          name: "Early Adopter",
          slug: "early-adopter",
          color: "#e0e7ff",
          textColor: "#3730a3",
          icon: null,
          priority: 10,
        }}
      />
    );
    expect(htmlNoIcon).toContain("Early Adopter");

    const htmlUnknownIcon = renderToString(
      <BadgeChip
        badge={{
          id: "b3",
          name: "Unknown Icon",
          slug: "unknown-icon",
          color: "#fee2e2",
          textColor: "#991b1b",
          icon: "non-existent-icon",
          priority: 0,
        }}
      />
    );
    expect(htmlUnknownIcon).toContain("Unknown Icon");
  });

  it("renders author line with badges sorted by priority", () => {
    const author = {
      name: "Jane Doe",
      image: null,
      role: "customer" as const,
      badges: [
        {
          id: "b1",
          name: "Contributor",
          slug: "contributor",
          color: "#dbeafe",
          textColor: "#1e40af",
          icon: "award",
          priority: 10,
        },
        {
          id: "b2",
          name: "VIP",
          slug: "vip",
          color: "#fef08a",
          textColor: "#854d0e",
          icon: "crown",
          priority: 100,
        },
      ],
    };

    const html = renderToString(
      <AuthorLine
        author={author}
        createdAt="2026-11-09T10:00:00Z"
      />
    );

    expect(html).toContain("Jane Doe");
    expect(html).toContain("VIP");
    expect(html).toContain("Contributor");
    // VIP (priority 100) appears before Contributor (priority 10)
    const vipIndex = html.indexOf("VIP");
    const contributorIndex = html.indexOf("Contributor");
    expect(vipIndex).toBeLessThan(contributorIndex);
  });
});
