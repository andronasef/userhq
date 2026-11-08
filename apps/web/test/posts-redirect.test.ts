import { describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

import RedirectPostPage from "../app/dashboard/[ws]/[product]/posts/[number]/page";
import RedirectPostsPage from "../app/dashboard/[ws]/[product]/posts/page";

describe("Dashboard posts legacy routes redirect", () => {
  it("redirects /dashboard/[ws]/[product]/posts/[number] to /dashboard/[ws]/[product]/board/[number]", async () => {
    await expect(
      RedirectPostPage({
        params: Promise.resolve({
          ws: "increasing-labs",
          product: "soundboard-maker",
          number: "2",
        }),
      })
    ).rejects.toThrow("NEXT_REDIRECT: /dashboard/increasing-labs/soundboard-maker/board/2");

    expect(mockRedirect).toHaveBeenCalledWith(
      "/dashboard/increasing-labs/soundboard-maker/board/2"
    );
  });

  it("redirects /dashboard/[ws]/[product]/posts to /dashboard/[ws]/[product]/board", async () => {
    await expect(
      RedirectPostsPage({
        params: Promise.resolve({
          ws: "increasing-labs",
          product: "soundboard-maker",
        }),
      })
    ).rejects.toThrow("NEXT_REDIRECT: /dashboard/increasing-labs/soundboard-maker/board");

    expect(mockRedirect).toHaveBeenCalledWith(
      "/dashboard/increasing-labs/soundboard-maker/board"
    );
  });
});
