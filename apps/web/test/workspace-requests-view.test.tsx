import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummary, WorkspaceRequestItem } from "@userhq/types";
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
    expect(select).toMatch(/\sdisabled=""/);
    expect(select).toContain('title="Select a product to filter by category"');
  });

  it("enables the category select with All categories plus the product's categories", () => {
    const html = render({ currentProduct: "alpha", categories, currentCategoryId: categories[0].id });
    const select = html.match(/<select[^>]*aria-label="Filter by category"[^>]*>/)?.[0] ?? "";
    expect(select).not.toMatch(/\sdisabled=""/);
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

describe("WorkspaceRequestsView post links", () => {
  const req: WorkspaceRequestItem = {
    id: "r1",
    number: 2,
    slug: "soundboard-enhancement",
    title: "Soundboard Enhancement",
    description: "More audio formats",
    voteCount: 5,
    createdAt: "2026-05-01T10:00:00.000Z",
    product: {
      id: "p1",
      slug: "soundboard-maker",
      name: "Soundboard Maker",
      logoUrl: null,
      accentColor: "#2563EB",
    },
    status: { id: "s1", name: "In Progress", color: "#3B82F6", type: "active" },
    category: { id: "c1", name: "Audio" },
    author: { name: "Alice", image: null, isAdmin: false, deleted: false },
    commentCount: 2,
  };

  it("hides the public portal link when the product's board is disabled or unknown", () => {
    const html = render({ initialRequests: [req], initialTotalCount: 1 });
    expect(html).toContain('href="/dashboard/work/soundboard-maker/board/2"');
    expect(html).not.toContain("Public portal");
  });

  it("renders both platform dashboard and public portal post links, without legacy /posts/ url", () => {
    const html = render({
      initialRequests: [req],
      initialTotalCount: 1,
      products: [
        { ...product, slug: "soundboard-maker" } as ProductSummary,
      ],
    });
    // Title and Dashboard link point to dashboard board route
    expect(html).toContain('href="/dashboard/work/soundboard-maker/board/2"');
    // Public portal link points to portal post route
    expect(html).toContain('href="/work/soundboard-maker/p/2-soundboard-enhancement"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Public portal");
    // Does not use the broken /posts/ link
    expect(html).not.toContain("/posts/2");
  });

  it("renders author email mailto link and location badge when provided", () => {
    const itemWithGeo: WorkspaceRequestItem = {
      ...req,
      author: {
        name: "Alice",
        image: null,
        isAdmin: false,
        deleted: false,
        email: "alice@example.com",
        location: {
          country: "United States",
          countryCode: "US",
          city: "San Francisco",
        },
      },
    };
    const html = render({ initialRequests: [itemWithGeo], initialTotalCount: 1 });
    expect(html).toContain('href="mailto:alice@example.com"');
    expect(html).toContain("alice@example.com");
    expect(html).toContain("United States");
    expect(html).toContain('title="San Francisco, United States"');
  });
});


