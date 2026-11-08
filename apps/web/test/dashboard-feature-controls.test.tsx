import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSidebar } from "../components/dashboard/sidebar";
import { HiddenModuleNotice } from "../components/dashboard/hidden-module-notice";
import { BoardView } from "../app/dashboard/[ws]/[product]/board/board-view";
import { portalHref } from "../lib/tenant";
import type { ProductSummary } from "@userhq/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/work/app/board",
  useRouter: () => ({ push: () => undefined }),
}));
// BoardFilters reads nuqs state; the empty states under test do not depend on it.
vi.mock("../components/dashboard/board-filters", () => ({ BoardFilters: () => null }));

describe("Dashboard feature visibility", () => {
  it("keeps hidden modules manageable and labels their sidebar links", () => {
    const product = {
      id: "product", name: "App", slug: "app", logoUrl: null,
      accentColor: "#123456", features: { board: false, roadmap: false, changelog: true, faq: false },
    } as ProductSummary;
    const html = renderToStaticMarkup(<DashboardSidebar ws="work" products={[product]} />);
    expect(html).toContain('href="/dashboard/work/app/board"');
    expect(html).toContain('href="/dashboard/work/app/roadmap"');
    expect(html).toContain('href="/dashboard/work/app/faq"');
    expect(html.match(/title="Hidden from customers"/g)).toHaveLength(3);
    expect(html).toContain("View portal");
  });

  it("explains retained Board content and links directly to its settings", () => {
    const html = renderToStaticMarkup(<HiddenModuleNotice ws="work" product="app" module="board" />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Your posts and comments are kept.");
    expect(html).toContain('href="/dashboard/work/app/settings#portal-features"');
    expect(html).toContain("Turn on in settings");
  });

  describe("Board empty state (U6)", () => {
    const board = (boardEnabled: boolean, isFiltered = false) =>
      renderToStaticMarkup(
        <BoardView
          ws="work" product="app" boardEnabled={boardEnabled} initialPosts={[]} initialNextCursor={null}
          statuses={[]} categories={[]} isFiltered={isFiltered}
        />,
      );

    it("links to the portal only while the Board is on", () => {
      const on = board(true);
      expect(on).toContain("View portal");
      expect(on).toContain(`href="${portalHref("work", "app")}"`);
      const off = board(false);
      expect(off).toContain("No posts yet");
      expect(off).not.toContain("View portal");
      expect(off).not.toContain(portalHref("work", "app"));
    });

    it("keeps the filtered empty state identical in both cases", () => {
      const on = board(true, true);
      expect(on).toContain("No posts match");
      expect(on).toContain("Clear filters");
      expect(board(false, true)).toBe(on);
    });
  });
});
