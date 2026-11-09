import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { seedTenants, type Seed } from "./support/seed.js";

describe("Badge admin contracts", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let seed: Seed;
  let base: string;
  let badgeId: string;
  let customer: { cookie: string; userId: string };
  const call = (method: "get" | "post" | "patch" | "delete", path: string) =>
    request(app.http)
      [method](base + path)
      .set("Origin", app.env.PUBLIC_URL)
      .set("Cookie", seed.a.cookie);
  beforeAll(async () => {
    app = await createTestApp();
    seed = await seedTenants(app);
    base = `/api/v1/workspaces/${seed.a.slug}/products/${seed.a.productSlug}`;
    customer = await signedInCookie(app.test, {
      name: "Customer",
      email: "badge-customer@example.test",
      emailVerified: true,
    });
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  it("creates badges and enforces unique slugs", async () => {
    const res = await call("post", "/badges").send({
      name: "PRO",
      slug: "pro",
      priority: 10,
    });
    expect(res.status).toBe(201);
    badgeId = res.body.id;
    expect(res.body.rules).toEqual([]);
    expect(
      (await call("post", "/badges").send({ name: "Duplicate", slug: "pro" }))
        .status,
    ).toBe(409);
  });
  it("validates bodies and maps malformed identifiers to 404", async () => {
    const bad = await call("post", "/badges").send({ name: "" });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("validation_failed");
    const id = await call("patch", "/badges/not-a-uuid").send({
      name: "Renamed",
    });
    expect(id.status).toBe(404);
    expect(id.body.code).toBe("not_found");
    expect((await call("get", "/users?page=bad")).status).toBe(400);
  });
  it("keeps secrets write-only, and update returns the same complete rule shape as list", async () => {
    const rule = await call("post", `/badges/${badgeId}/rules`).send({
      paramKey: "tier",
      matchValue: "pro",
      secretToken: "private-secret",
    });
    expect(rule.status).toBe(201);
    expect(rule.body.hasSecretToken).toBe(true);
    expect(rule.body.keyMatchType).toBe("exact");
    expect(rule.body.secretToken).toBeUndefined();
    const update = await call("patch", `/badges/${badgeId}`).send({
      name: "PRO Member",
    });
    const list = await call("get", "/badges");
    expect(update.body.rulesCount).toBe(1);
    expect(update.body.rules).toEqual(
      list.body.items.find((b: any) => b.id === badgeId).rules,
    );
    expect(JSON.stringify(list.body)).not.toContain("private-secret");
  });
  it("rejects uncompilable and group-escaping patterns and reserved keys", async () => {
    for (const pattern of ["[", "a)|(.*"]) {
      const res = await call("post", `/badges/${badgeId}/rules`).send({
        paramKey: "tier",
        matchType: "regex",
        matchValue: pattern,
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("badge_rule_invalid");
    }
    expect(
      (
        await call("post", `/badges/${badgeId}/rules`).send({
          paramKey: "tier_sig",
          matchValue: "pro",
        })
      ).status,
    ).toBe(400);
  });
  it("matches regex parameter names and values as whole strings", async () => {
    const res = await call("post", `/badges/${badgeId}/rules`).send({
      paramKey: "utm_.*",
      keyMatchType: "regex",
      matchType: "regex",
      matchValue: "a|b",
    });
    expect(res.status).toBe(201);
    expect(res.body.keyMatchType).toBe("regex");
    const url = `/api/v1/portal/${seed.a.slug}/${seed.a.productSlug}/badges/attribute`;
    for (const [params, count] of [
      [{ utm_source: "a" }, 1],
      [{ xutm_source: "a" }, 0],
      [{ utm_source: "ab" }, 0],
    ] as const) {
      const attr = await request(app.http)
        .post(url)
        .set("Origin", app.env.PUBLIC_URL)
        .send({ searchParams: params });
      expect(attr.status).toBe(201);
      expect(attr.body.matchedBadges).toHaveLength(count);
    }
  });
  it("requires membership or product participation for grants and avoids existence oracles", async () => {
    for (const userId of [customer.userId, randomUUID()]) {
      const res = await call("post", `/users/${userId}/badges`).send({
        badgeId,
      });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("badge_user_not_member");
    }
    expect(
      (await call("post", `/users/${seed.a.userId}/badges`).send({ badgeId }))
        .status,
    ).toBe(201);
    const first = new Date("2026-01-01T12:00:00Z");
    await app.db
      .insert(schema.posts)
      .values({
        productId: seed.a.productId!,
        number: 1,
        title: "Feedback",
        description: "Description",
        authorId: customer.userId,
        statusId: seed.a.statusId!,
        createdAt: first,
      });
    expect(
      (await call("post", `/users/${customer.userId}/badges`).send({ badgeId }))
        .status,
    ).toBe(201);
    const foreign = await call("post", `/users/${customer.userId}/badges`).send(
      { badgeId: seed.b.badgeId },
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe("not_found");
  });
  it("uses product activity dates, including badge-only users", async () => {
    const first = "2026-01-01T12:00:00.000Z";
    const latest = "2026-02-01T12:00:00.000Z";
    const [p] = await app.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.productId, seed.a.productId!));
    await app.db
      .insert(schema.comments)
      .values({
        postId: p.id,
        authorId: customer.userId,
        body: "Reply",
        createdAt: new Date(latest),
      });
    await app.db
      .insert(schema.posts)
      .values({
        productId: seed.b.productId!,
        number: 2,
        title: "Older elsewhere",
        description: "Elsewhere",
        authorId: customer.userId,
        statusId: seed.b.statusId!,
        createdAt: new Date("2020-01-01T00:00:00Z"),
      });
    const grantDate = "2026-03-01T00:00:00.000Z";
    await app.db
      .update(schema.userProductBadges)
      .set({ createdAt: new Date(grantDate) })
      .where(eq(schema.userProductBadges.userId, seed.a.userId));
    const list = await call("get", "/users");
    expect(list.status).toBe(200);
    const item = list.body.items.find((u: any) => u.id === customer.userId);
    expect(item.firstSeenAt).toBe(first);
    expect(item.lastActiveAt).toBe(latest);
    expect(item.email).toBe("badge-customer@example.test");
    const member = list.body.items.find((u: any) => u.id === seed.a.userId);
    expect(member.firstSeenAt).toBe(grantDate);
    expect(member.lastActiveAt).toBe(grantDate);
    const key = await request(app.http)
      .post(`/api/v1/workspaces/${seed.a.slug}/api-keys`)
      .set("Origin", app.env.PUBLIC_URL)
      .set("Cookie", seed.a.cookie)
      .send({ name: "Badge Reader", scopes: ["settings:read"] });
    expect(key.status).toBe(201);
    const keyed = await request(app.http)
      .get(base + "/users")
      .set("Authorization", `Bearer ${key.body.token}`);
    expect(keyed.status).toBe(200);
    expect(keyed.body.items.every((u: any) => u.email === null)).toBe(true);
  });
  it("caps rules per product and deletes rules, grants and badges", async () => {
    const existing = await app.db
      .select()
      .from(schema.productBadgeRules)
      .where(eq(schema.productBadgeRules.productId, seed.a.productId!));
    await app.db
      .insert(schema.productBadgeRules)
      .values(
        Array.from({ length: 50 - existing.length }, (_, i) => ({
          productId: seed.a.productId!,
          badgeId,
          paramKey: `p${i}`,
          matchValue: "x",
        })),
      );
    const over = await call("post", `/badges/${badgeId}/rules`).send({
      paramKey: "extra",
      matchValue: "x",
    });
    expect(over.status).toBe(400);
    expect(over.body.code).toBe("badge_rule_invalid");
    expect(
      (await call("delete", `/badges/${badgeId}/rules/${existing[0].id}`))
        .status,
    ).toBe(204);
    expect(
      (await call("delete", `/users/${customer.userId}/badges/${badgeId}`))
        .status,
    ).toBe(204);
    expect((await call("delete", `/badges/${badgeId}`)).status).toBe(204);
    expect((await call("get", "/badges")).body.items).toHaveLength(0);
  });
  it("does not let API keys search hidden emails, but sessions can", async () => {
    const created = await request(app.http)
      .post(`/api/v1/workspaces/${seed.a.slug}/api-keys`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", app.env.PUBLIC_URL)
      .send({ name: "Badge reader", scopes: ["settings:read"] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const search = "badge-customer@example.test";
    const viaKey = await request(app.http)
      .get(`${base}/users?search=${encodeURIComponent(search)}`)
      .set("Authorization", `Bearer ${created.body.token}`);
    expect(viaKey.status).toBe(200);
    expect(viaKey.body.total).toBe(0);
    const viaSession = await call("get", `/users?search=${encodeURIComponent(search)}`);
    expect(viaSession.body.total).toBe(1);
  });
  it("never lets concurrent rule creation exceed the cap", async () => {
    const badge = (await call("post", "/badges").send({ name: "Conc", slug: "conc" })).body;
    const existing = await app.db
      .select()
      .from(schema.productBadgeRules)
      .where(eq(schema.productBadgeRules.productId, seed.a.productId!));
    await app.db.insert(schema.productBadgeRules).values(
      Array.from({ length: 49 - existing.length }, (_, i) => ({
        productId: seed.a.productId!,
        badgeId: badge.id,
        paramKey: `c${i}`,
        matchValue: "x",
      })),
    );
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        call("post", `/badges/${badge.id}/rules`).send({ paramKey: `race${i}`, matchValue: "x" }),
      ),
    );
    const rows = await app.db
      .select()
      .from(schema.productBadgeRules)
      .where(eq(schema.productBadgeRules.productId, seed.a.productId!));
    expect(rows.length).toBeLessThanOrEqual(50);
  });
});
