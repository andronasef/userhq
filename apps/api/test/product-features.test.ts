import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

const enabled = { board: true, roadmap: true, changelog: true, faq: true };

describe("Product feature settings", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let owner: { cookie: string; userId: string };
  let admin: { cookie: string; userId: string };
  let customer: { cookie: string; userId: string };
  const path = "/api/v1/workspaces/features/products/app";
  beforeAll(async () => {
    app = await createTestApp();
    owner = await signedInCookie(app.test, {
      name: "Owner",
      email: "owner@features.test",
      emailVerified: true,
    });
    admin = await signedInCookie(app.test, {
      name: "Admin",
      email: "admin@features.test",
      emailVerified: true,
    });
    customer = await signedInCookie(app.test, {
      name: "Customer",
      email: "customer@features.test",
      emailVerified: true,
    });
    const [ws] = await app.db
      .insert(schema.workspaces)
      .values({ name: "Features", slug: "features" })
      .returning();
    await app.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: owner.userId, role: "owner" },
      { workspaceId: ws.id, userId: admin.userId, role: "admin" },
    ]);
    await app.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, name: "App", slug: "app" });
    const [other] = await app.db
      .insert(schema.workspaces)
      .values({ name: "Other", slug: "other-features" })
      .returning();
    await app.db
      .insert(schema.products)
      .values({ workspaceId: other.id, name: "App", slug: "app" });
  });
  beforeEach(async () => {
    await patch({ features: enabled });
  });
  afterAll(async () => {
    await app?.close();
  });
  const patch = (body: unknown, cookie = owner.cookie, url = path) =>
    request(app.http)
      .patch(url)
      .set("Cookie", cookie)
      .set("Origin", app.env.PUBLIC_URL)
      .send(body);

  it("round-trips independent settings without replacing sibling values", async () => {
    const initial = await request(app.http)
      .get(path)
      .set("Cookie", owner.cookie);
    expect(initial.status).toBe(200);
    expect(initial.body.features).toEqual(enabled);
    const changed = await patch({ features: { board: false } });
    expect(changed.status).toBe(200);
    expect(changed.body.features).toEqual({ ...enabled, board: false });
    const loaded = await request(app.http)
      .get(path)
      .set("Cookie", owner.cookie);
    expect(loaded.body.features).toEqual(changed.body.features);
    const list = await request(app.http)
      .get("/api/v1/workspaces/features/products")
      .set("Cookie", owner.cookie);
    expect(list.body[0].features).toEqual(changed.body.features);
    const portal = await request(app.http).get("/api/v1/portal/features/app");
    expect(portal.status).toBe(200);
    expect(portal.body.product.features).toEqual(changed.body.features);
    expect((await patch({ features: { board: true } })).body.features).toEqual(
      enabled,
    );
  });

  it("rejects invalid feature values and unknown keys without changing saved state", async () => {
    for (const features of [
      { board: "false" },
      { faq: null },
      { unknown: true },
    ]) {
      expect((await patch({ features })).status).toBe(400);
    }
    expect(
      (await request(app.http).get(path).set("Cookie", owner.cookie)).body
        .features,
    ).toEqual(enabled);
  });

  it("allows admins, denies customers and does not cross workspace boundaries", async () => {
    expect(
      (await patch({ features: { faq: false } }, admin.cookie)).status,
    ).toBe(200);
    expect(
      (await patch({ features: { faq: true } }, customer.cookie)).status,
    ).toBe(404);
    expect(
      (
        await patch(
          { features: { faq: true } },
          owner.cookie,
          "/api/v1/workspaces/other-features/products/app",
        )
      ).status,
    ).toBe(404);
    expect(
      (await patch({ features: { faq: true } }, admin.cookie)).body.features,
    ).toEqual(enabled);
  });

  it("merges concurrent distinct keys and preserves features on unrelated or empty patches", async () => {
    const results = await Promise.all([
      patch({ features: { roadmap: false } }),
      patch({ features: { changelog: false } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const expected = { ...enabled, roadmap: false, changelog: false };
    expect(
      (await patch({ name: "Renamed", tagline: "Still here" })).body.features,
    ).toEqual(expected);
    expect((await patch({})).body.features).toEqual(expected);
    expect((await patch({ features: {} })).body.features).toEqual(expected);
    expect((await patch({ features: enabled })).body.features).toEqual(enabled);
  });
});
