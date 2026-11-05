import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    owner = await signedInCookie(app.test, { name: "Owner", email: "owner@features.test", emailVerified: true });
    admin = await signedInCookie(app.test, { name: "Admin", email: "admin@features.test", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "Customer", email: "customer@features.test", emailVerified: true });
    const [ws] = await app.db.insert(schema.workspaces).values({ name: "Features", slug: "features" }).returning();
    await app.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: owner.userId, role: "owner" },
      { workspaceId: ws.id, userId: admin.userId, role: "admin" },
    ]);
    await app.db.insert(schema.products).values({ workspaceId: ws.id, name: "App", slug: "app" });
    const [other] = await app.db.insert(schema.workspaces).values({ name: "Other", slug: "other-features" }).returning();
    await app.db.insert(schema.products).values({ workspaceId: other.id, name: "App", slug: "app" });
  });
  afterAll(async () => { await app?.close(); });
  const patch = (body: unknown, cookie = owner.cookie, url = path) => request(app.http).patch(url).set("Cookie", cookie).set("Origin", app.env.PUBLIC_URL).send(body);

  it("round-trips independent settings without replacing sibling values", async () => {
    const initial = await request(app.http).get(path).set("Cookie", owner.cookie);
    expect(initial.status).toBe(200);
    expect(initial.body.features).toEqual(enabled);
    const changed = await patch({ features: { board: false } });
    expect(changed.status).toBe(200);
    expect(changed.body.features).toEqual({ ...enabled, board: false });
    const loaded = await request(app.http).get(path).set("Cookie", owner.cookie);
    expect(loaded.body.features).toEqual(changed.body.features);
    const list = await request(app.http).get("/api/v1/workspaces/features/products").set("Cookie", owner.cookie);
    expect(list.body[0].features).toEqual(changed.body.features);
    const portal = await request(app.http).get("/api/v1/portal/features/app");
    expect(portal.status).toBe(200);
    expect(portal.body.product.features).toEqual(changed.body.features);
    expect((await patch({ features: { board: true } })).body.features).toEqual(enabled);
  });
});
