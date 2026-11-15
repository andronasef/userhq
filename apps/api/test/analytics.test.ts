import { describe, it, expect } from "vitest";
import { analyticsContext, recordOutcome } from "../src/analytics/context.js";
import {
  signAuthOutcome,
  verifyAuthOutcome,
} from "../src/analytics/auth-outcome.js";
import { telemetryId } from "../src/analytics/analytics.interceptor.js";
import { AnalyticsReceiptSchema, notificationDestination } from "@userhq/types";

describe("analytics security", () => {
  const secret = "private-test-secret-never-forwarded";
  it("binds real authentication evidence to session, user, purpose and expiry", () => {
    const now = Date.now();
    const token = signAuthOutcome(
      {
        session: "session-one",
        user: "user-one",
        signup: true,
        method: "google",
        expires: now + 60000,
      },
      secret,
    );
    expect(
      verifyAuthOutcome(token, secret, "session-one", "user-one", now)?.signup,
    ).toBe(true);
    expect(
      verifyAuthOutcome(token, secret, "session-two", "user-one", now),
    ).toBeNull();
    expect(
      verifyAuthOutcome(token, secret, "session-one", "user-two", now),
    ).toBeNull();
    expect(
      verifyAuthOutcome(token + "x", secret, "session-one", "user-one", now),
    ).toBeNull();
    expect(
      verifyAuthOutcome(token, secret, "session-one", "user-one", now + 60001),
    ).toBeNull();
  });
  it("keeps concurrent outcome buffers separate and rejects unbounded properties", async () => {
    const a: any[] = [],
      b: any[] = [];
    await Promise.all([
      analyticsContext.run({ events: a }, async () => {
        await Promise.resolve();
        recordOutcome("vote_added", {
          action: "vote",
          email: "private@example.com",
        } as any);
      }),
      analyticsContext.run({ events: b }, async () => {
        recordOutcome("comment_created", { action: "comment" });
      }),
    ]);
    expect(a).toEqual([{ name: "vote_added", properties: { action: "vote" } }]);
    expect(b).toEqual([
      { name: "comment_created", properties: { action: "comment" } },
    ]);
    recordOutcome("vote_added"); // background/disabled capture is harmless
  });
  it("uses keyed opaque tenant identifiers and rejects accidental raw IDs", () => {
    const id = telemetryId("workspace-secret-slug", secret);
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(id).not.toBe(telemetryId("workspace-secret-slug", "other-salt"));
    expect(
      AnalyticsReceiptSchema.safeParse({ id: "bad", events: [] }).success,
    ).toBe(false);
  });
  it("marks notification destinations without changing hash or touching credential routes", () => {
    expect(
      notificationDestination("/acme/core/p/1#comment", "push", "reply"),
    ).toBe("/acme/core/p/1?uhq_channel=push&uhq_type=reply#comment");
    expect(
      notificationDestination("/unsubscribe/private-token", "email", "reply"),
    ).toBe("/unsubscribe/private-token");
  });
});
