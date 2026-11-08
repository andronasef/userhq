import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkspaceCommentItem } from "@userhq/types";
import { WorkspaceCommentsView } from "../components/workspace-dashboard/workspace-comments-view";

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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  fetchWorkspaceComments: vi.fn(),
  markCommentHandled: vi.fn(),
  reopenComment: vi.fn(),
  replyWorkspaceComment: vi.fn(),
  markCommentRead: vi.fn(),
}));

const customer = { name: "Cy Customer", image: null, isAdmin: false, deleted: false };
const ann = { name: "Ann Admin", image: null, isAdmin: true, deleted: false };

function comment(id: string, extra: Partial<WorkspaceCommentItem> = {}): WorkspaceCommentItem {
  return {
    id,
    body: `body-${id}`,
    isAdmin: false,
    createdAt: "2026-05-01T10:00:00.000Z",
    editedAt: null,
    handledAt: null,
    handledBy: null,
    isUnread: false,
    post: { id: "p", number: 7, slug: "dark-mode", title: "Dark mode" },
    product: { id: "pr", slug: "prod", name: "Prod", logoUrl: null, accentColor: "#2563EB" },
    author: customer,
    ...extra,
  };
}

function render(items: WorkspaceCommentItem[], boardEnabled = true): string {
  return renderToStaticMarkup(
    <WorkspaceCommentsView
      ws="work"
      products={[
        {
          slug: "prod",
          name: "Prod",
          logoUrl: null,
          accentColor: "#2563EB",
          features: { board: boardEnabled, roadmap: true, changelog: true, faq: true },
        },
      ]}
      initialComments={items}
      initialNextCursor={null}
      initialNeedsAttentionCount={items.length}
      currentAttention="all"
    />
  );
}

const markAsReadButtons = (html: string) => html.match(/<button[^>]*aria-label="Mark as read[^"]*"[^>]*>/g) ?? [];

describe("WorkspaceCommentsView", () => {
  it("renders one native Mark as read button per unread row, named with author and post", () => {
    const html = render([comment("u1", { isUnread: true }), comment("u2", { isUnread: true }), comment("r1")]);
    const buttons = markAsReadButtons(html);
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b).toContain('type="button"');
      expect(b).toContain("Cy Customer");
      expect(b).toContain("Dark mode");
    }
    expect(html).toContain(">Mark as read<");
  });

  it("renders no Mark as read button for a read comment", () => {
    expect(markAsReadButtons(render([comment("r1")]))).toHaveLength(0);
  });

  it("offers Reopen on a handled customer comment", () => {
    const html = render([comment("h1", { handledAt: "2026-05-02T10:00:00.000Z", handledBy: ann })]);
    expect(html).toContain("Reopen");
    expect(html).toContain("Handled by Ann Admin");
  });

  it("never offers Reopen on an admin reply, even when handledAt is set", () => {
    const html = render([
      comment("a1", {
        isAdmin: true,
        author: ann,
        handledAt: "2026-05-02T10:00:00.000Z",
        handledBy: ann,
      }),
    ]);
    expect(html).not.toContain("Reopen");
  });

  it("labels a deleted handler as a former member instead of naming them", () => {
    const html = render([
      comment("d1", {
        handledAt: "2026-05-02T10:00:00.000Z",
        handledBy: { name: null, image: null, isAdmin: false, deleted: true },
      }),
    ]);
    expect(html).toContain("Handled by a former member");
  });

  it("renders both platform dashboard and public portal post links, without legacy /posts/ url", () => {
    const html = render([comment("c1")]);
    expect(html).toContain('href="/dashboard/work/prod/board/7"');
    expect(html).toContain('href="/work/prod/p/7-dark-mode"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Public portal");
    expect(html).not.toContain("/posts/7");
  });

  it("hides the public portal link when the product's board is disabled", () => {
    const html = render([comment("c1")], false);
    expect(html).toContain('href="/dashboard/work/prod/board/7"');
    expect(html).not.toContain("Public portal");
  });

  it("renders comment author email mailto link and location badge when provided", () => {
    const c = comment("c-geo", {
      author: {
        name: "Cy Customer",
        image: null,
        isAdmin: false,
        deleted: false,
        email: "cy@example.com",
        location: {
          country: "Egypt",
          countryCode: "EG",
          city: "Cairo",
        },
      },
    });
    const html = render([c]);
    expect(html).toContain('href="mailto:cy@example.com"');
    expect(html).toContain("cy@example.com");
    expect(html).toContain("Egypt");
    expect(html).toContain('title="Cairo, Egypt"');
  });
});
