import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

/**
 * Story 20 (D-05, D-11): product settings, statuses, categories and FAQ are automation targets with
 * their own scopes. Every case asserts the database row, not only the status code.
 */
describe("automation: scoped configuration routes (quick-261108-b3i)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerA: { cookie: string; userId: string };
  let ownerB: { cookie: string; userId: string };
  let wsA: { id: string; slug: string };
  let wsB: { id: string; slug: string };
  let p1: { id: string; slug: string };
  let p2: { id: string; slug: string };
  let pb: { id: string; slug: string };

  const asOwner = (o: { cookie: string }) => ({ Cookie: o.cookie, Origin: testApp.env.PUBLIC_URL });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (...parts: string[]) => `/api/v1/workspaces/${parts.join("/")}`;

  const mint = async (
    ws: { slug: string },
    owner: { cookie: string },
    name: string,
    scopes: readonly string[],
    productRestrictions?: string[]
  ) => {
    const res = await request(testApp.http)
      .post(api(ws.slug, "api-keys"))
      .set(asOwner(owner))
      .send({ name, scopes, ...(productRestrictions ? { productRestrictions } : {}) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.token as string;
  };

  const productRow = async (id: string) =>
    (await testApp.db.select().from(schema.products).where(eq(schema.products.id, id)))[0];
  const productCount = async (workspaceId: string) =>
    (await testApp.db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.workspaceId, workspaceId))).length;

  const seedProduct = async (workspaceId: string, slug: string) => {
    const [p] = await testApp.db
      .insert(schema.products)
      .values({ workspaceId, name: `Product ${slug}`, slug })
      .returning();
    return { id: p.id, slug: p.slug };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    const stamp = Date.now();
    ownerA = await signedInCookie(testApp.test, {
      name: "Config Owner A",
      email: `config-a-${stamp}@userhq.test`,
      emailVerified: true,
    });
    ownerB = await signedInCookie(testApp.test, {
      name: "Config Owner B",
      email: `config-b-${stamp}@userhq.test`,
      emailVerified: true,
    });
    const mkWs = async (slug: string, owner: { userId: string }) => {
      const [ws] = await testApp.db.insert(schema.workspaces).values({ name: slug, slug }).returning();
      await testApp.db
        .insert(schema.workspaceMembers)
        .values({ workspaceId: ws.id, userId: owner.userId, role: "owner" });
      return { id: ws.id, slug };
    };
    wsA = await mkWs(`cfg-a-${stamp}`, ownerA);
    wsB = await mkWs(`cfg-b-${stamp}`, ownerB);
    p1 = await seedProduct(wsA.id, `cfg-p1-${stamp}`);
    p2 = await seedProduct(wsA.id, `cfg-p2-${stamp}`);
    pb = await seedProduct(wsB.id, `cfg-pb-${stamp}`);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  describe("product settings (settings:read / settings:write)", () => {
    it("a settings:write key changes feature flags and profile fields; the row matches", async () => {
      const token = await mint(wsA, ownerA, "Settings writer", ["settings:write"]);
      const res = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(token))
        .send({ features: { roadmap: false }, tagline: "Set by a key" });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.features.roadmap).toBe(false);
      expect(res.body.tagline).toBe("Set by a key");

      const row = await productRow(p1.id);
      expect(row.roadmapEnabled).toBe(false);
      expect(row.tagline).toBe("Set by a key");
      // restore for later cases
      await testApp.db.update(schema.products).set({ roadmapEnabled: true, tagline: null }).where(eq(schema.products.id, p1.id));
    });

    it("a settings:read key reads the product and the list, but cannot PATCH", async () => {
      const token = await mint(wsA, ownerA, "Settings reader", ["settings:read"]);
      const get = await request(testApp.http).get(api(wsA.slug, "products", p1.slug)).set(bearer(token));
      expect(get.status, JSON.stringify(get.body)).toBe(200);
      expect(get.body.slug).toBe(p1.slug);

      const list = await request(testApp.http).get(api(wsA.slug, "products")).set(bearer(token));
      expect(list.status, JSON.stringify(list.body)).toBe(200);
      const slugs = (list.body as { slug: string }[]).map((p) => p.slug).sort();
      expect(slugs).toEqual([p1.slug, p2.slug].sort());
      expect(slugs).not.toContain(pb.slug);

      const before = await productRow(p1.id);
      const patch = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(token))
        .send({ tagline: "Nope", features: { board: false } });
      expect(patch.status).toBe(403);
      expect(patch.body.code).toBe("insufficient_scope");
      const after = await productRow(p1.id);
      expect(after.tagline).toBe(before.tagline);
      expect(after.boardEnabled).toBe(before.boardEnabled);
    });

    it("an unrelated scope cannot PATCH; an admin key reaches get, list and patch", async () => {
      const other = await mint(wsA, ownerA, "Requests writer", ["requests:write"]);
      const before = await productRow(p1.id);
      const denied = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(other))
        .send({ tagline: "Nope" });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe("insufficient_scope");
      expect((await productRow(p1.id)).tagline).toBe(before.tagline);

      const admin = await mint(wsA, ownerA, "Admin", ["admin"]);
      expect((await request(testApp.http).get(api(wsA.slug, "products")).set(bearer(admin))).status).toBe(200);
      expect((await request(testApp.http).get(api(wsA.slug, "products", p1.slug)).set(bearer(admin))).status).toBe(200);
      const patch = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(admin))
        .send({ tagline: "Admin tagline" });
      expect(patch.status).toBe(200);
      expect((await productRow(p1.id)).tagline).toBe("Admin tagline");
      await testApp.db.update(schema.products).set({ tagline: null }).where(eq(schema.products.id, p1.id));
    });

    it("no key can create or delete a product", async () => {
      const count = await productCount(wsA.id);
      for (const scopes of [["admin"], ["settings:write"]]) {
        const token = await mint(wsA, ownerA, `Closed ${scopes[0]}`, scopes);
        const create = await request(testApp.http)
          .post(api(wsA.slug, "products"))
          .set(bearer(token))
          .send({ name: "Key product", slug: `key-made-${scopes[0].replace(":", "-")}` });
        expect(create.status).toBe(403);
        expect(create.body.code).toBe("api_key_route_forbidden");
        const del = await request(testApp.http).delete(api(wsA.slug, "products", p2.slug)).set(bearer(token));
        expect(del.status).toBe(403);
        expect(del.body.code).toBe("api_key_route_forbidden");
      }
      expect(await productCount(wsA.id)).toBe(count);
      expect((await productRow(p2.id)).deletedAt).toBeNull();
    });

    it("a key restricted to P1 reaches P1 only, and not the product list", async () => {
      const token = await mint(wsA, ownerA, "P1 only", ["settings:read", "settings:write"], [p1.id]);
      const ok = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(token))
        .send({ tagline: "P1 ok" });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect((await productRow(p1.id)).tagline).toBe("P1 ok");

      const before = await productRow(p2.id);
      const blocked = await request(testApp.http)
        .patch(api(wsA.slug, "products", p2.slug))
        .set(bearer(token))
        .send({ tagline: "P2 hacked" });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe("product_restricted");
      expect((await productRow(p2.id)).tagline).toBe(before.tagline);

      const list = await request(testApp.http).get(api(wsA.slug, "products")).set(bearer(token));
      expect(list.status).toBe(403);
      expect(list.body.code).toBe("product_restricted");
      await testApp.db.update(schema.products).set({ tagline: null }).where(eq(schema.products.id, p1.id));
    });

    it("a key of workspace A gets 404 on workspace B's product routes; B is unchanged", async () => {
      const token = await mint(wsA, ownerA, "Cross tenant", ["admin"]);
      const before = await productRow(pb.id);
      for (const res of [
        await request(testApp.http).get(api(wsB.slug, "products", pb.slug)).set(bearer(token)),
        await request(testApp.http).get(api(wsB.slug, "products")).set(bearer(token)),
        await request(testApp.http)
          .patch(api(wsB.slug, "products", pb.slug))
          .set(bearer(token))
          .send({ tagline: "Hacked", features: { board: false } }),
      ]) {
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("not_found");
      }
      const after = await productRow(pb.id);
      expect(after.tagline).toBe(before.tagline);
      expect(after.boardEnabled).toBe(before.boardEnabled);
      expect(after.deletedAt).toBeNull();
    });

    it("a key can clear the logo but cannot set another user's upload", async () => {
      const [upload] = await testApp.db
        .insert(schema.uploads)
        .values({ storageKey: `2026/11/cfg-${Date.now()}.webp`, bytes: 10, width: 10, height: 10, uploaderId: ownerA.userId })
        .returning();
      await testApp.db.update(schema.products).set({ logoUploadId: upload.id }).where(eq(schema.products.id, p1.id));
      const token = await mint(wsA, ownerA, "Logo key", ["settings:write"]);

      const clear = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(token))
        .send({ logoUploadId: null });
      expect(clear.status, JSON.stringify(clear.body)).toBe(200);
      expect((await productRow(p1.id)).logoUploadId).toBeNull();

      const set = await request(testApp.http)
        .patch(api(wsA.slug, "products", p1.slug))
        .set(bearer(token))
        .send({ logoUploadId: upload.id });
      expect(set.status).toBe(400);
      expect(set.body.code).toBe("validation_failed");
      expect((await productRow(p1.id)).logoUploadId).toBeNull();
    });
  });
});
