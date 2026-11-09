import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import {
  attributionCookieName,
  signAttributionCookie,
  ATTRIBUTION_MAX_AGE_MS,
} from "../src/badges/attribution.js";

describe("Public badge attribution", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let customer: { cookie: string; userId: string };
  let productId: string;
  let otherProductId: string;
  let badgeId: string;
  let base: string;
  const secret = "signed-rule-test-secret";
  beforeAll(async () => {
    app = await createTestApp();
    customer = await signedInCookie(app.test, {
      name: "Customer",
      emailVerified: true,
    });
    const [ws] = await app.db
      .insert(schema.workspaces)
      .values({ name: "Badge Portal", slug: "badge-portal" })
      .returning();
    const [product] = await app.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, name: "Product", slug: "product" })
      .returning();
    const [other] = await app.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, name: "Other", slug: "other" })
      .returning();
    productId = product.id;
    otherProductId = other.id;
    const [status] = await app.db
      .insert(schema.statuses)
      .values({
        productId,
        name: "Review",
        color: "#000000",
        type: "review",
        position: 0,
        isDefault: true,
      })
      .returning();
    await app.db
      .insert(schema.posts)
      .values({
        productId,
        number: 1,
        authorId: customer.userId,
        title: "Feedback",
        description: "Description",
        statusId: status.id,
      });
    const [badge] = await app.db
      .insert(schema.productBadges)
      .values({ productId, name: "PRO", slug: "pro" })
      .returning();
    badgeId = badge.id;
    const [regex] = await app.db
      .insert(schema.productBadges)
      .values({ productId, name: "Tester", slug: "tester" })
      .returning();
    await app.db.insert(schema.productBadgeRules).values([
      {
        productId,
        badgeId,
        paramKey: "purchase",
        matchType: "exact",
        matchValue: "pro",
        secretToken: secret,
      },
      {
        productId,
        badgeId: regex.id,
        paramKey: "tier",
        matchType: "regex",
        matchValue: "pro",
      },
    ]);
    base = "/api/v1/portal/badge-portal/product";
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  const signed = (ts = String(Math.floor(Date.now() / 1000))) => ({
    purchase: "pro",
    purchase_ts: ts,
    purchase_sig: createHmac("sha256", secret)
      .update(`pro.${ts}`)
      .digest("hex"),
  });
  const attribute = (searchParams: Record<string, string>) =>
    request(app.http)
      .post(`${base}/badges/attribute`)
      .set("Origin", app.env.PUBLIC_URL)
      .send({ searchParams });
  it("removes self-claim entirely", async () => {
    const res = await request(app.http)
      .post(`${base}/badges/claim`)
      .set("Origin", app.env.PUBLIC_URL)
      .set("Cookie", customer.cookie)
      .send({ badgeIds: [badgeId] });
    expect(res.status).toBe(404);
    expect(await app.db.select().from(schema.userProductBadges)).toHaveLength(
      0,
    );
  });
  it("issues a signed httpOnly cookie and only public badge data", async () => {
    const res = await attribute(signed());
    expect(res.status).toBe(201);
    expect(res.body.matchedBadges[0].slug).toBe("pro");
    expect(res.body.scrubKeys).toEqual(
      expect.arrayContaining(["purchase", "purchase_sig", "purchase_ts"]),
    );
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toContain(attributionCookieName(productId));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain('["');
    expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(JSON.stringify(res.body)).not.toContain("secretToken");
  });
  it("rejects bad signatures and timestamps cleanly", async () => {
    for (const params of [
      { ...signed(), purchase_sig: "bad" },
      { ...signed(), purchase_sig: "é".repeat(64) },
      { purchase: "pro", purchase_sig: "abc" },
      { purchase: "pro" },
      signed(
        String(
          Math.floor((Date.now() - ATTRIBUTION_MAX_AGE_MS - 10000) / 1000),
        ),
      ),
      signed(String(Math.floor((Date.now() + 600000) / 1000))),
    ]) {
      const res = await attribute(params);
      expect(res.status).toBe(201);
      expect(res.body.matchedBadges).toEqual([]);
    }
  });
  it("bounds public inputs and anchors regex values", async () => {
    expect(
      (
        await attribute(
          Object.fromEntries(
            Array.from({ length: 51 }, (_, i) => [`p${i}`, "x"]),
          ),
        )
      ).status,
    ).toBe(400);
    expect((await attribute({ tier: "x".repeat(257) })).status).toBe(400);
    expect((await attribute({ tier: "pro" })).body.matchedBadges).toHaveLength(
      1,
    );
    expect(
      (await attribute({ tier: "xproy" })).body.matchedBadges,
    ).toHaveLength(0);
  });
  it("binds guest attribution on a vote and clears the cookie", async () => {
    const raw = signAttributionCookie(app.env.BETTER_AUTH_SECRET, productId, [
      { badgeId, value: "pro" },
    ]);
    const res = await request(app.http)
      .put(`${base}/posts/1/vote`)
      .set("Origin", app.env.PUBLIC_URL)
      .set(
        "Cookie",
        `${customer.cookie}; ${attributionCookieName(productId)}=${raw}`,
      );
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"].join(";")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
    expect(await app.db.select().from(schema.userProductBadges)).toEqual([
      expect.objectContaining({
        badgeId,
        productId,
        userId: customer.userId,
        source: "rule",
      }),
    ]);
    await app.db.delete(schema.userProductBadges);
  });
  it("ignores forged, expired, foreign-product and foreign-badge cookies on normal actions", async () => {
    for (const raw of [
      "forged",
      signAttributionCookie(app.env.BETTER_AUTH_SECRET, otherProductId, [
        { badgeId, value: "pro" },
      ]),
      signAttributionCookie(
        app.env.BETTER_AUTH_SECRET,
        productId,
        [{ badgeId, value: "pro" }],
        Date.now() - ATTRIBUTION_MAX_AGE_MS - 10000,
      ),
      signAttributionCookie(app.env.BETTER_AUTH_SECRET, productId, [
        { badgeId: randomUUID(), value: "pro" },
      ]),
    ]) {
      const res = await request(app.http)
        .put(`${base}/posts/1/vote`)
        .set("Origin", app.env.PUBLIC_URL)
        .set(
          "Cookie",
          `${customer.cookie}; ${attributionCookieName(productId)}=${raw}`,
        );
      expect(res.status).toBe(200);
      expect(await app.db.select().from(schema.userProductBadges)).toHaveLength(
        0,
      );
    }
  });
  it("binds immediately for signed-in visitors and consumes a stale cookie on empty params", async () => {
    const res = await attribute(signed()).set("Cookie", customer.cookie);
    expect(res.status).toBe(201);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(
      await app.db
        .select()
        .from(schema.userProductBadges)
        .where(eq(schema.userProductBadges.productId, productId)),
    ).toHaveLength(1);
    const empty = await attribute({}).set(
      "Cookie",
      `${customer.cookie}; ${attributionCookieName(productId)}=invalid`,
    );
    expect(empty.headers["set-cookie"].join(";")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
  });
});

describe("Attribution throttle", () => {
  it("limits each guest to 60 calls a minute", async () => {
    const app = await createTestApp();
    try {
      const [ws] = await app.db
        .insert(schema.workspaces)
        .values({ name: "Throttle", slug: "throttle" })
        .returning();
      await app.db
        .insert(schema.products)
        .values({ workspaceId: ws.id, name: "Product", slug: "product" });
      for (let i = 0; i < 61; i++) {
        const res = await request(app.http)
          .post("/api/v1/portal/throttle/product/badges/attribute")
          .set("Origin", app.env.PUBLIC_URL)
          .send({ searchParams: {} });
        expect(res.status).toBe(i < 60 ? 201 : 429);
      }
    } finally {
      await app.close();
    }
  });
});
