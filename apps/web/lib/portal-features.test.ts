import { describe, expect, it } from "vitest";
import { landingHref, portalTabs, portalDescription } from "./portal-features";

describe("portal feature availability", () => {
  const cases = [
    [false, false, false, false, null, [], "Widget from Acme."],
    [false, false, false, true, "/w/p/faq", ["FAQ"], "Find answers to common questions about Widget."],
    [false, false, true, false, "/w/p/changelog", ["Changelog"], "Read what's new in Widget."],
    [false, false, true, true, "/w/p/changelog", ["Changelog", "FAQ"], "Read what's new in Widget."],
    [false, true, false, false, "/w/p/roadmap", ["Roadmap"], "See what's planned for Widget."],
    [false, true, false, true, "/w/p/roadmap", ["Roadmap", "FAQ"], "See what's planned for Widget."],
    [false, true, true, false, "/w/p/roadmap", ["Roadmap", "Changelog"], "See what's planned for Widget."],
    [false, true, true, true, "/w/p/roadmap", ["Roadmap", "Changelog", "FAQ"], "See what's planned for Widget."],
    [true, false, false, false, "/w/p", ["Feedback"], "Share feedback and vote on ideas for Widget."],
    [true, false, false, true, "/w/p", ["Feedback", "FAQ"], "Share feedback and vote on ideas for Widget."],
    [true, false, true, false, "/w/p", ["Feedback", "Changelog"], "Share feedback and vote on ideas for Widget."],
    [true, false, true, true, "/w/p", ["Feedback", "Changelog", "FAQ"], "Share feedback and vote on ideas for Widget."],
    [true, true, false, false, "/w/p", ["Feedback", "Roadmap"], "Share feedback, vote on ideas, and follow what's coming next for Widget."],
    [true, true, false, true, "/w/p", ["Feedback", "Roadmap", "FAQ"], "Share feedback, vote on ideas, and follow what's coming next for Widget."],
    [true, true, true, false, "/w/p", ["Feedback", "Roadmap", "Changelog"], "Share feedback, vote on ideas, and follow what's coming next for Widget."],
    [true, true, true, true, "/w/p", ["Feedback", "Roadmap", "Changelog", "FAQ"], "Share feedback, vote on ideas, and follow what's coming next for Widget."],
  ] as const;

  for (const [board, roadmap, changelog, faq, landing, labels, description] of cases) {
    it(`composes ${[board, roadmap, changelog, faq].join("/")}`, () => {
      const features = { board, roadmap, changelog, faq };
      expect(landingHref("w", "p", features)).toBe(landing);
      expect(portalTabs("w", "p", features, false).map((tab) => tab.label)).toEqual(labels);
      expect(portalTabs("w", "p", features, true).map((tab) => tab.label)).toEqual(board ? [...labels, "Activity"] : labels);
      expect(portalDescription("Widget", "Acme", features)).toBe(description);
    });
  }

  it("encodes route segments", () => {
    const features = { board: false, roadmap: true, changelog: false, faq: false };
    expect(landingHref("a b", "c d", features)).toBe("/a%20b/c%20d/roadmap");
    expect(portalTabs("a b", "c d", features, false)[0].href).toBe("/a%20b/c%20d/roadmap");
  });
});
