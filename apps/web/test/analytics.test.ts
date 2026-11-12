import { describe, expect, it } from "vitest";
import { AnalyticsEventSchema } from "@userhq/types";
import { analyticsRoute } from "../lib/analytics-route";

describe("analytics privacy boundaries", () => {
  it("never exposes content slugs, query strings, invite tokens or unknown paths", () => {
    expect(analyticsRoute("/acme/widget/p/12-private-request?token=secret#email").route).toBe("/:ws/:product/p/:ref");
    for (const path of ["/invite/secret", "/unsubscribe/secret", "/api/auth/callback/google?code=secret", "/unknown/secret/deep"]) {
      expect(analyticsRoute(path).track).toBe(false);
      expect(analyticsRoute(path).record).toBe(false);
    }
  });
  it("only allows known public content screens for replay", () => {
    for (const path of ["/", "/acme", "/acme/widget", "/acme/widget/faq", "/acme/widget/roadmap", "/acme/widget/changelog/release-one"]) {
      expect(analyticsRoute(path).record).toBe(true);
    }
    for (const path of ["/dashboard/acme/widget/roadmap", "/platform", "/account", "/login", "/acme/widget/activity"]) {
      expect(analyticsRoute(path).record).toBe(false);
    }
  });
  it("strips arbitrary telemetry properties and rejects raw identities", () => {
    const event = AnalyticsEventSchema.parse({ name: "search_completed", properties: { module: "faq", result_count: 0, search: "secret@email.com", title: "Private", cookie: "secret" } });
    expect(event.properties).toEqual({ module: "faq", result_count: 0 });
    expect(AnalyticsEventSchema.safeParse({ name: "login", properties: { workspace_id: "customer@email.com" } }).success).toBe(false);
  });
});
