import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummary } from "@userhq/types";
import {
  WorkspaceRequestsView,
  LoadMoreFooter,
  buildRequestsQuery,
} from "../components/workspace-dashboard/workspace-requests-view";
import { fetchWorkspaceRequests } from "../lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const product = {
  id: "p1",
  name: "Alpha",
  slug: "alpha",
  logoUrl: null,
  accentColor: "#2563EB",
  features: { board: true, roadmap: true, changelog: true, faq: true },
} as ProductSummary;

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Performance", postCount: 3 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Billing", postCount: 1 },
];

function render(props: Partial<React.ComponentProps<typeof WorkspaceRequestsView>> = {}): string {
  return renderToStaticMarkup(
    <WorkspaceRequestsView
      ws="work"
      products={[product]}
      initialRequests={[]}
      initialNextCursor={null}
      initialTotalCount={0}
      categories={[]}
      {...props}
    />
  );
}

describe("WorkspaceRequestsView filter bar", () => {
  it("renders labelled native date inputs with values from the URL and cross-constrained bounds", () => {
    const html = render({ currentCreatedFrom: "2026-04-01", currentCreatedTo: "2026-04-30" });
    const from = html.match(/<input[^>]*aria-label="Created from \(UTC\)"[^>]*>/)?.[0] ?? "";
    const to = html.match(/<input[^>]*aria-label="Created to \(UTC\)"[^>]*>/)?.[0] ?? "";
    expect(from).toContain('type="date"');
    expect(from).toContain('value="2026-04-01"');
    expect(from).toContain('max="2026-04-30"');
    expect(to).toContain('type="date"');
    expect(to).toContain('value="2026-04-30"');
    expect(to).toContain('min="2026-04-01"');
  });

  it("disables the category select with an explanation when no product is selected", () => {
    const html = render();
    const select = html.match(/<select[^>]*aria-label="Filter by category"[^>]*>/)?.[0] ?? "";
    expect(select).toContain("disabled");
    expect(select).toContain('title="Select a product to filter by category"');
  });

  it("enables the category select with All categories plus the product's categories", () => {
    const html = render({ currentProduct: "alpha", categories, currentCategoryId: categories[0].id });
    const select = html.match(/<select[^>]*aria-label="Filter by category"[^>]*>/)?.[0] ?? "";
    expect(select).not.toContain("disabled");
    expect(html).toContain("All categories");
    expect(html).toContain(">Performance<");
    expect(html).toContain(">Billing<");
  });

  it.each([
    ["category", { currentProduct: "alpha", currentCategoryId: categories[0].id }],
    ["created from", { currentCreatedFrom: "2026-04-01" }],
    ["created to", { currentCreatedTo: "2026-04-30" }],
  ])("treats an active %s filter as filtered state (Reset and clear action)", (_name, props) => {
    const html = render({ categories, ...props });
    expect(html).toContain("Reset");
    expect(html).toContain("Clear filters");
  });

  it("shows no Reset when nothing is filtered", () => {
    expect(render()).not.toContain("Reset");
  });
});

describe("buildRequestsQuery", () => {
  it("includes every active filter plus the cursor", () => {
    expect(
      buildRequestsQuery(
        {
          product: "alpha",
          statusType: "planned",
          categoryId: categories[0].id,
          createdFrom: "2026-04-01",
          createdTo: "2026-04-30",
          sort: "new",
          search: "export",
        },
        "cursor-1"
      )
    ).toEqual({
      product: "alpha",
      statusType: "planned",
      categoryId: categories[0].id,
      createdFrom: "2026-04-01",
      createdTo: "2026-04-30",
      sort: "new",
      search: "export",
      cursor: "cursor-1",
    });
  });

  it("omits empty filters and the cursor when absent", () => {
    expect(buildRequestsQuery({ product: "", statusType: "", search: "" })).toEqual({});
  });
});

describe("LoadMoreFooter", () => {
  const noop = () => {};
  it("renders an alert with a retry action when a load more failed", () => {
    const html = renderToStaticMarkup(
      <LoadMoreFooter hasNext loading={false} error="Network down" onLoadMore={noop} onRetry={noop} />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Network down");
    expect(html).toContain("Try again");
  });

  it("renders neither alert nor retry without an error", () => {
    const html = renderToStaticMarkup(
      <LoadMoreFooter hasNext loading={false} error={null} onLoadMore={noop} onRetry={noop} />
    );
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Try again");
    expect(html).toContain("Load more requests");
  });

  it("renders nothing when there is no next page and no error", () => {
    expect(
      renderToStaticMarkup(
        <LoadMoreFooter hasNext={false} loading={false} error={null} onLoadMore={noop} onRetry={noop} />
      )
    ).toBe("");
  });
});

describe("fetchWorkspaceRequests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("serializes createdFrom and createdTo in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null, totalCount: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchWorkspaceRequests("work", { createdFrom: "2026-04-01", createdTo: "2026-04-30", categoryId: categories[0].id });
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.searchParams.get("createdFrom")).toBe("2026-04-01");
    expect(url.searchParams.get("createdTo")).toBe("2026-04-30");
    expect(url.searchParams.get("categoryId")).toBe(categories[0].id);
  });
});
