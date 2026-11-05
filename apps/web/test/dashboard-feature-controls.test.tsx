import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSidebar } from "../components/dashboard/sidebar";
import type { ProductSummary } from "@userhq/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/work/app/board" }));

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
});
