import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsEventSchema, ANONYMOUS_ME } from "@userhq/types";
import { analyticsRoute } from "../lib/analytics-route";
import {
  configureAnalytics,
  relayAnalyticsReceipt,
  track,
  clearAnalyticsIdentity,
} from "../lib/analytics";
import { needsDocumentNavigation } from "../lib/analytics-navigation";

describe("analytics privacy boundaries", () => {
  it("never exposes content slugs, query strings, invite tokens or unknown paths", () => {
    expect(
      analyticsRoute("/acme/widget/p/12-private-request?token=secret#email")
        .route,
    ).toBe("/:ws/:product/p/:ref");
    for (const path of [
      "/invite/secret",
      "/unsubscribe/secret",
      "/api/auth/callback/google?code=secret",
      "/unknown/secret/deep",
    ]) {
      expect(analyticsRoute(path).track).toBe(false);
      expect(analyticsRoute(path).record).toBe(false);
    }
  });
  it("only allows known public content screens for replay", () => {
    for (const path of [
      "/",
      "/acme",
      "/acme/widget",
      "/acme/widget/faq",
      "/acme/widget/roadmap",
      "/acme/widget/changelog/release-one",
    ]) {
      expect(analyticsRoute(path).record).toBe(true);
    }
    for (const path of [
      "/dashboard/acme/widget/roadmap",
      "/platform",
      "/account",
      "/login",
      "/acme/widget/activity",
    ]) {
      expect(analyticsRoute(path).record).toBe(false);
    }
  });
  it("strips arbitrary telemetry properties and rejects raw identities", () => {
    const event = AnalyticsEventSchema.parse({
      name: "search_completed",
      properties: {
        module: "faq",
        result_count: 0,
        search: "secret@email.com",
        title: "Private",
        cookie: "secret",
      },
    });
    expect(event.properties).toEqual({ module: "faq", result_count: 0 });
    expect(
      AnalyticsEventSchema.safeParse({
        name: "login",
        properties: { workspace_id: "customer@email.com" },
      }).success,
    ).toBe(false);
  });
});

describe("analytics delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  function setup(owner = false) {
    const w = {
      location: { pathname: "/acme/widget", origin: "https://example.com" },
      dataLayer: [] as any[],
      clarity: vi.fn(),
    };
    vi.stubGlobal("window", w);
    configureAnalytics(true, { ...ANONYMOUS_ME, isPlatformOwner: owner }, null);
    return w;
  }
  it("relays validated success once, drops sensitive fields and clears stale dataLayer properties", () => {
    const w = setup();
    const receipt = btoa(
      JSON.stringify({
        id: "b73881e5-7ad6-4a76-bf8f-2cb9d82fd684",
        events: [
          {
            name: "vote_added",
            properties: {
              actor_role: "customer",
              action: "vote",
              email: "private@example.com",
            },
          },
        ],
      }),
    );
    relayAnalyticsReceipt(receipt);
    relayAnalyticsReceipt(receipt);
    expect(
      w.dataLayer.filter((x) => x.event_name === "vote_added"),
    ).toHaveLength(1);
    expect(w.dataLayer[0].email).toBeUndefined();
    expect(w.dataLayer[0].page_location).toBe(
      "https://example.com/:ws/:product",
    );
    track("content_opened", { module: "faq" });
    expect(w.dataLayer.at(-1).action).toBeNull();
    clearAnalyticsIdentity();
    expect(w.dataLayer.at(-1).user_id).toBeNull();
  });
  it("suppresses platform owner and tolerates broken vendors and malformed receipts", () => {
    const w = setup(true);
    track("portal_viewed");
    expect(w.dataLayer).toEqual([]);
    configureAnalytics(true, ANONYMOUS_ME, null);
    w.dataLayer.push = () => {
      throw new Error("blocked vendor");
    };
    expect(() => track("portal_viewed")).not.toThrow();
    expect(() => relayAnalyticsReceipt("bad-secret-token")).not.toThrow();
  });
  it("requires a document boundary before private or query-bearing content can render", () => {
    expect(
      needsDocumentNavigation("/acme/widget", "/dashboard/acme/widget/roadmap"),
    ).toBe(true);
    expect(
      needsDocumentNavigation("/acme/widget", "/acme/widget?q=private"),
    ).toBe(true);
    expect(
      needsDocumentNavigation("/dashboard/acme", "/dashboard/acme/team"),
    ).toBe(false);
    expect(needsDocumentNavigation("/acme/widget", "/acme/widget")).toBe(false);
  });
});
