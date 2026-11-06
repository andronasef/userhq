import { describe, expect, it } from "vitest";
import type { WorkspaceCommentItem } from "@userhq/types";
import { applyReplyToFeed } from "./workspace-inbox";

const author = { name: "Customer", image: null, isAdmin: false, deleted: false };
const admin = { name: "Admin Ann", image: null, isAdmin: true, deleted: false };

function comment(id: string, extra: Partial<WorkspaceCommentItem> = {}): WorkspaceCommentItem {
  return {
    id,
    body: id,
    isAdmin: false,
    createdAt: "2026-05-01T10:00:00.000Z",
    editedAt: null,
    handledAt: null,
    handledBy: null,
    isUnread: false,
    post: { id: "p", number: 1, slug: "post", title: "Post" },
    product: { id: "pr", slug: "prod", name: "Prod", logoUrl: null, accentColor: "#000000" },
    author,
    ...extra,
  };
}

const reply = comment("reply", {
  isAdmin: true,
  author: admin,
  createdAt: "2026-05-02T09:00:00.000Z",
});

describe("applyReplyToFeed", () => {
  it("marks an unhandled customer parent handled by the reply author and time, delta -1", () => {
    const items = [comment("a"), comment("b"), comment("c")];
    const result = applyReplyToFeed(items, "b", reply, "needs_attention");
    const parent = result.items.find((c) => c.id === "b")!;
    expect(parent.handledAt).toBe(reply.createdAt);
    expect(parent.handledBy).toEqual(admin);
    expect(result.needsAttentionDelta).toBe(-1);
    expect(result.items.find((c) => c.id === "a")).toBe(items[0]);
    expect(result.items.find((c) => c.id === "c")).toBe(items[2]);
  });

  it("does not insert the reply in the needs_attention list", () => {
    const result = applyReplyToFeed([comment("a")], "a", reply, "needs_attention");
    expect(result.items.map((c) => c.id)).toEqual(["a"]);
  });

  it.each(["all", "handled"] as const)("inserts the reply right after its parent in %s mode", (attention) => {
    const result = applyReplyToFeed([comment("a"), comment("b"), comment("c")], "b", reply, attention);
    expect(result.items.map((c) => c.id)).toEqual(["a", "b", "reply", "c"]);
  });

  it("never duplicates a reply id", () => {
    const first = applyReplyToFeed([comment("a")], "a", reply, "all");
    const second = applyReplyToFeed(first.items, "a", reply, "all");
    expect(second.items.filter((c) => c.id === "reply")).toHaveLength(1);
  });

  it("reports delta 0 and keeps the original handler when the parent was already handled", () => {
    const handled = comment("a", {
      handledAt: "2026-05-01T12:00:00.000Z",
      handledBy: { ...admin, name: "Admin Ben" },
    });
    const result = applyReplyToFeed([handled], "a", reply, "all");
    expect(result.needsAttentionDelta).toBe(0);
    expect(result.items[0]).toBe(handled);
  });

  it("reports delta 0 when the parent is an admin comment", () => {
    const adminParent = comment("a", { isAdmin: true, author: admin });
    const result = applyReplyToFeed([adminParent], "a", reply, "all");
    expect(result.needsAttentionDelta).toBe(0);
    expect(result.items[0]).toBe(adminParent);
  });

  it("leaves the list unchanged when the parent is not on the page", () => {
    const items = [comment("a")];
    const result = applyReplyToFeed(items, "missing", reply, "all");
    expect(result.items).toEqual(items);
    expect(result.needsAttentionDelta).toBe(0);
  });
});
