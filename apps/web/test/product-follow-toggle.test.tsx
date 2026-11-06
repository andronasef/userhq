import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductFollowToggle,
  changeFollow,
  setProductFollow,
} from "../components/workspace-dashboard/product-follow-toggle";
import { ApiClientError } from "../lib/api-client";

const ok = () => new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
const notFound = () => new Response(JSON.stringify({ code: "not_found", message: "Not found." }), { status: 404, headers: { "content-type": "application/json" } });

afterEach(() => { vi.unstubAllGlobals(); });

describe("ProductFollowToggle markup", () => {
  it("renders Follow with aria-pressed false and the product name in the accessible name", () => {
    const html = renderToStaticMarkup(<ProductFollowToggle ws="work" productSlug="app" productName="My App" initialFollowing={false} />);
    expect(html).toMatch(/^<button/);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Follow My App"');
    expect(html).toContain(">Follow<");
    expect(html).not.toContain('disabled=""');
  });

  it("renders Following with aria-pressed true", () => {
    const html = renderToStaticMarkup(<ProductFollowToggle ws="work" productSlug="app" productName="My App" initialFollowing />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">Following<");
    expect(html).toContain('aria-label="Follow My App"');
  });
});

describe("setProductFollow", () => {
  it("POSTs to the encoded tenant-guarded path to follow and DELETEs to unfollow", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    await setProductFollow("my ws", "a/b", true);
    await setProductFollow("my ws", "a/b", false);
    const path = "/api/v1/workspaces/my%20ws/products/a%2Fb/push-follow";
    expect(fetchMock.mock.calls.map((c) => [c[0], c[1].method])).toEqual([[path, "POST"], [path, "DELETE"]]);
  });

  it("rejects with ApiClientError on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => notFound()));
    await expect(setProductFollow("work", "app", true)).rejects.toBeInstanceOf(ApiClientError);
  });
});

describe("changeFollow", () => {
  const hooks = () => ({ setFollowing: vi.fn(), setPending: vi.fn(), onError: vi.fn() });

  it("updates optimistically, holds pending for the request, and keeps the new state on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok()));
    const ui = hooks();
    await changeFollow("work", "app", true, ui);
    expect(ui.setFollowing.mock.calls).toEqual([[true]]);
    expect(ui.setPending.mock.calls).toEqual([[true], [false]]);
    expect(ui.onError).not.toHaveBeenCalled();
  });

  it("rolls back and reports an error when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => notFound()));
    const ui = hooks();
    await changeFollow("work", "app", true, ui);
    expect(ui.setFollowing.mock.calls).toEqual([[true], [false]]);
    expect(ui.setPending.mock.calls).toEqual([[true], [false]]);
    expect(ui.onError).toHaveBeenCalledOnce();
  });
});
