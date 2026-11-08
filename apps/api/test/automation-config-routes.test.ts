import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { generateKeyBetween } from "@userhq/types";
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

  describe("statuses, categories and FAQ", () => {
    type Prod = { id: string; slug: string };
    const answer = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Answer text for the key." }] }] };
    const seeded: Record<string, { open: string; planned: string; category: string; faqCategory: string; faqQuestion: string }> = {};

    const call = (method: "get" | "post" | "patch" | "put" | "delete", token: string, url: string, body?: object) => {
      const r = (request(testApp.http) as any)[method](url).set(bearer(token));
      return body ? r.send(body) : r;
    };
    const base = (ws: { slug: string }, p: Prod, kind: "statuses" | "categories" | "faq") => api(ws.slug, "products", p.slug, kind);

    const statusRows = async (productId: string) =>
      (await testApp.db.select({ id: schema.statuses.id, name: schema.statuses.name, position: schema.statuses.position, isDefault: schema.statuses.isDefault })
        .from(schema.statuses).where(eq(schema.statuses.productId, productId))).sort((a, b) => a.position - b.position);
    const categoryRows = async (productId: string) =>
      (await testApp.db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)
        .where(eq(schema.categories.productId, productId))).sort((a, b) => a.id.localeCompare(b.id));
    const faqRows = async (productId: string) => ({
      categories: (await testApp.db.select({ id: schema.faqCategories.id, name: schema.faqCategories.name, rank: schema.faqCategories.rank })
        .from(schema.faqCategories).where(eq(schema.faqCategories.productId, productId))).sort((a, b) => a.id.localeCompare(b.id)),
      questions: (await testApp.db.select({ id: schema.faqQuestions.id, question: schema.faqQuestions.question })
        .from(schema.faqQuestions).where(eq(schema.faqQuestions.productId, productId))).sort((a, b) => a.id.localeCompare(b.id)),
    });
    const postActivityCount = async () => (await testApp.db.select({ id: schema.postActivity.id }).from(schema.postActivity)).length;

    beforeAll(async () => {
      for (const p of [p1, p2, pb]) {
        const [open, planned] = await testApp.db
          .insert(schema.statuses)
          .values([
            { productId: p.id, name: "Open", type: "review", color: "#3B82F6", position: 0, isDefault: true },
            { productId: p.id, name: "Planned", type: "planned", color: "#8B5CF6", position: 1 },
          ])
          .returning();
        const [category] = await testApp.db.insert(schema.categories).values({ productId: p.id, name: "Seed" }).returning();
        const [faqCategory] = await testApp.db.insert(schema.faqCategories).values({ productId: p.id, name: "Seed FAQ", rank: "a0" }).returning();
        const [faqQuestion] = await testApp.db
          .insert(schema.faqQuestions)
          .values({ productId: p.id, categoryId: faqCategory.id, question: "Seeded question?", answer, rank: "a0" })
          .returning();
        seeded[p.id] = { open: open.id, planned: planned.id, category: category.id, faqCategory: faqCategory.id, faqQuestion: faqQuestion.id };
      }
    });

    describe("statuses (settings pair)", () => {
      it("a settings:read key lists statuses and cannot write; the rows are unchanged", async () => {
        const token = await mint(wsA, ownerA, "Status reader", ["settings:read"]);
        const url = base(wsA, p1, "statuses");
        const list = await call("get", token, url);
        expect(list.status, JSON.stringify(list.body)).toBe(200);
        expect(list.body.map((r: { name: string }) => r.name)).toEqual(["Open", "Planned"]);

        const before = await statusRows(p1.id);
        const s = seeded[p1.id];
        const ids = before.map((r) => r.id);
        for (const res of [
          await call("post", token, url, { name: "Nope", type: "active", color: "#112233" }),
          await call("patch", token, `${url}/${s.planned}`, { name: "Renamed" }),
          await call("put", token, `${url}/${s.planned}/default`),
          await call("put", token, `${url}/order`, { ids: [...ids].reverse() }),
          await call("delete", token, `${url}/${s.planned}?moveTo=${s.open}`),
        ]) {
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("insufficient_scope");
        }
        expect(await statusRows(p1.id)).toEqual(before);
      });

      it("a settings:write key creates, renames, defaults, reorders and deletes; posts move and no activity is written", async () => {
        const token = await mint(wsA, ownerA, "Status writer", ["settings:write"]);
        const url = base(wsA, p1, "statuses");
        const s = seeded[p1.id];

        const created = await call("post", token, url, { name: "Shipped", type: "completed", color: "#10B981" });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const shippedId = created.body.id as string;

        const dup = await call("post", token, url, { name: "shipped", type: "active", color: "#10B981" });
        expect(dup.status).toBe(409);
        expect(dup.body.code).toBe("status_name_taken");

        const renamed = await call("patch", token, `${url}/${shippedId}`, { name: "Released" });
        expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
        expect(renamed.body.name).toBe("Released");

        const del = await call("delete", token, `${url}/${s.open}?moveTo=${shippedId}`);
        expect(del.status).toBe(400);
        expect(del.body.code).toBe("delete_default_status");

        const setDefault = await call("put", token, `${url}/${shippedId}/default`);
        expect(setDefault.status, JSON.stringify(setDefault.body)).toBe(200);
        expect((await statusRows(p1.id)).find((r) => r.id === shippedId)?.isDefault).toBe(true);

        const order = [shippedId, s.planned, s.open];
        const reordered = await call("put", token, `${url}/order`, { ids: order });
        expect(reordered.status, JSON.stringify(reordered.body)).toBe(200);
        expect((await statusRows(p1.id)).map((r) => r.id)).toEqual(order);

        const [post] = await testApp.db
          .insert(schema.posts)
          .values({ productId: p1.id, number: 1, title: "Moves with its status", authorId: ownerA.userId, statusId: s.planned })
          .returning();
        const activityBefore = await postActivityCount();
        const removed = await call("delete", token, `${url}/${s.planned}?moveTo=${s.open}`);
        expect(removed.status, JSON.stringify(removed.body)).toBe(204);
        const [moved] = await testApp.db.select().from(schema.posts).where(eq(schema.posts.id, post.id));
        expect(moved.statusId).toBe(s.open);
        // Audit guard: status deletes write no post_activity. If that ever changes the write must be attributed to the key.
        expect(await postActivityCount()).toBe(activityBefore);
        expect((await statusRows(p1.id)).map((r) => r.id)).toEqual([shippedId, s.open]);

        // restore the seeded shape for the isolation cases below
        await testApp.db.update(schema.statuses).set({ isDefault: false }).where(eq(schema.statuses.id, shippedId));
        await testApp.db.update(schema.statuses).set({ isDefault: true, position: 0 }).where(eq(schema.statuses.id, s.open));
        await testApp.db.delete(schema.posts).where(eq(schema.posts.id, post.id));
        await testApp.db.delete(schema.statuses).where(eq(schema.statuses.id, shippedId));
        const [replanned] = await testApp.db
          .insert(schema.statuses)
          .values({ productId: p1.id, name: "Planned", type: "planned", color: "#8B5CF6", position: 1 })
          .returning();
        s.planned = replanned.id;
      });
    });

    describe("categories (settings pair)", () => {
      it("a settings:read key lists categories and cannot write; the rows are unchanged", async () => {
        const token = await mint(wsA, ownerA, "Category reader", ["settings:read"]);
        const url = base(wsA, p1, "categories");
        const list = await call("get", token, url);
        expect(list.status, JSON.stringify(list.body)).toBe(200);
        expect(list.body.map((r: { name: string }) => r.name)).toEqual(["Seed"]);
        const before = await categoryRows(p1.id);
        const id = seeded[p1.id].category;
        for (const res of [
          await call("post", token, url, { name: "Nope" }),
          await call("patch", token, `${url}/${id}`, { name: "Renamed" }),
          await call("delete", token, `${url}/${id}`),
        ]) {
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("insufficient_scope");
        }
        expect(await categoryRows(p1.id)).toEqual(before);
      });

      it("a settings:write key creates, renames and deletes; posts of a deleted category end with category null", async () => {
        const token = await mint(wsA, ownerA, "Category writer", ["settings:write"]);
        const url = base(wsA, p1, "categories");
        const created = await call("post", token, url, { name: "Ideas" });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const dup = await call("post", token, url, { name: "ideas" });
        expect(dup.status).toBe(409);
        expect(dup.body.code).toBe("category_name_taken");
        const renamed = await call("patch", token, `${url}/${created.body.id}`, { name: "Big ideas" });
        expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
        expect(renamed.body.name).toBe("Big ideas");

        const [post] = await testApp.db
          .insert(schema.posts)
          .values({ productId: p1.id, number: 2, title: "Categorised", authorId: ownerA.userId, statusId: seeded[p1.id].open, categoryId: created.body.id })
          .returning();
        const removed = await call("delete", token, `${url}/${created.body.id}`);
        expect(removed.status).toBe(204);
        const [after] = await testApp.db.select().from(schema.posts).where(eq(schema.posts.id, post.id));
        expect(after.categoryId).toBeNull();
        expect((await categoryRows(p1.id)).map((r) => r.name)).toEqual(["Seed"]);
        await testApp.db.delete(schema.posts).where(eq(schema.posts.id, post.id));
      });
    });

    describe("FAQ (faq pair)", () => {
      it("a faq:read key reads the tree and categories and cannot write; the rows are unchanged", async () => {
        const token = await mint(wsA, ownerA, "FAQ reader", ["faq:read"]);
        const url = base(wsA, p1, "faq");
        const tree = await call("get", token, url);
        expect(tree.status, JSON.stringify(tree.body)).toBe(200);
        expect(JSON.stringify(tree.body)).toContain("Seeded question?");
        expect((await call("get", token, `${url}/categories`)).status).toBe(200);

        const before = await faqRows(p1.id);
        const s = seeded[p1.id];
        for (const res of [
          await call("post", token, `${url}/categories`, { name: "Nope" }),
          await call("patch", token, `${url}/categories/${s.faqCategory}`, { name: "Renamed" }),
          await call("patch", token, `${url}/categories/${s.faqCategory}/reorder`, { targetRank: "a1" }),
          await call("delete", token, `${url}/categories/${s.faqCategory}`),
          await call("post", token, `${url}/questions`, { categoryId: s.faqCategory, question: "Nope nope?", answer }),
          await call("patch", token, `${url}/questions/${s.faqQuestion}`, { question: "Renamed question?" }),
          await call("patch", token, `${url}/questions/${s.faqQuestion}/reorder`, { targetRank: "a1" }),
          await call("delete", token, `${url}/questions/${s.faqQuestion}`),
        ]) {
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("insufficient_scope");
        }
        expect(await faqRows(p1.id)).toEqual(before);
      });

      it("a faq:write key manages categories and questions end to end", async () => {
        const token = await mint(wsA, ownerA, "FAQ writer", ["faq:write"]);
        const url = base(wsA, p1, "faq");
        const cat = await call("post", token, `${url}/categories`, { name: "Billing" });
        expect(cat.status, JSON.stringify(cat.body)).toBe(201);
        const renamed = await call("patch", token, `${url}/categories/${cat.body.id}`, { name: "Billing and plans" });
        expect(renamed.status).toBe(200);
        const q = await call("post", token, `${url}/questions`, { categoryId: cat.body.id, question: "How do I pay?", answer });
        expect(q.status, JSON.stringify(q.body)).toBe(201);
        const edited = await call("patch", token, `${url}/questions/${q.body.id}`, { question: "How do I pay online?" });
        expect(edited.status).toBe(200);
        expect(edited.body.question).toBe("How do I pay online?");
        const catRank = generateKeyBetween(null, cat.body.rank);
        const catMove = await call("patch", token, `${url}/categories/${cat.body.id}/reorder`, { targetRank: catRank });
        expect(catMove.status, JSON.stringify(catMove.body)).toBe(200);
        const qRank = generateKeyBetween(null, q.body.rank);
        const qMove = await call("patch", token, `${url}/questions/${q.body.id}/reorder`, { targetRank: qRank });
        expect(qMove.status, JSON.stringify(qMove.body)).toBe(200);
        expect((await call("delete", token, `${url}/questions/${q.body.id}`)).status).toBe(204);
        expect((await call("delete", token, `${url}/categories/${cat.body.id}`)).status).toBe(204);
        expect((await faqRows(p1.id)).categories.map((c) => c.name)).toEqual(["Seed FAQ"]);
      });
    });

    describe("scope pairs do not cross", () => {
      it("settings:write cannot reach FAQ, faq:write cannot reach statuses or categories; nothing changes", async () => {
        const settings = await mint(wsA, ownerA, "Settings only", ["settings:read", "settings:write"]);
        const faq = await mint(wsA, ownerA, "FAQ only", ["faq:read", "faq:write"]);
        const s = seeded[p1.id];
        const faqBefore = await faqRows(p1.id);
        const statusBefore = await statusRows(p1.id);
        const catBefore = await categoryRows(p1.id);
        for (const res of [
          await call("get", settings, base(wsA, p1, "faq")),
          await call("post", settings, `${base(wsA, p1, "faq")}/categories`, { name: "Cross" }),
          await call("delete", settings, `${base(wsA, p1, "faq")}/questions/${s.faqQuestion}`),
          await call("get", faq, base(wsA, p1, "statuses")),
          await call("post", faq, base(wsA, p1, "statuses"), { name: "Cross", type: "active", color: "#112233" }),
          await call("get", faq, base(wsA, p1, "categories")),
          await call("post", faq, base(wsA, p1, "categories"), { name: "Cross" }),
        ]) {
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("insufficient_scope");
        }
        expect(await faqRows(p1.id)).toEqual(faqBefore);
        expect(await statusRows(p1.id)).toEqual(statusBefore);
        expect(await categoryRows(p1.id)).toEqual(catBefore);
      });

      it("an admin key reaches statuses, categories and FAQ", async () => {
        const admin = await mint(wsA, ownerA, "Admin all", ["admin"]);
        for (const kind of ["statuses", "categories", "faq"] as const) {
          expect((await call("get", admin, base(wsA, p1, kind))).status, kind).toBe(200);
        }
      });
    });

    describe("restricted keys and tenant isolation", () => {
      it("a key restricted to P1 reaches P1 and gets product_restricted on P2; P2 rows are unchanged", async () => {
        const token = await mint(wsA, ownerA, "P1 config", ["settings:read", "settings:write", "faq:read", "faq:write"], [p1.id]);
        const before = { s: await statusRows(p2.id), c: await categoryRows(p2.id), f: await faqRows(p2.id) };
        for (const kind of ["statuses", "categories", "faq"] as const) {
          expect((await call("get", token, base(wsA, p1, kind))).status, `${kind} on P1`).toBe(200);
          const read = await call("get", token, base(wsA, p2, kind));
          expect(read.status, `${kind} read on P2`).toBe(403);
          expect(read.body.code).toBe("product_restricted");
        }
        const writes = [
          await call("post", token, base(wsA, p2, "statuses"), { name: "Hacked", type: "active", color: "#112233" }),
          await call("post", token, base(wsA, p2, "categories"), { name: "Hacked" }),
          await call("post", token, `${base(wsA, p2, "faq")}/categories`, { name: "Hacked" }),
          await call("delete", token, `${base(wsA, p2, "faq")}/questions/${seeded[p2.id].faqQuestion}`),
        ];
        for (const res of writes) {
          expect(res.status).toBe(403);
          expect(res.body.code).toBe("product_restricted");
        }
        expect({ s: await statusRows(p2.id), c: await categoryRows(p2.id), f: await faqRows(p2.id) }).toEqual(before);
      });

      it("a key of workspace A gets 404 on workspace B's routes and on B's ids under A's slug; B is unchanged", async () => {
        const token = await mint(wsA, ownerA, "Cross config", ["admin"]);
        const b = seeded[pb.id];
        const before = { s: await statusRows(pb.id), c: await categoryRows(pb.id), f: await faqRows(pb.id) };
        const calls = [
          // B's slugs
          await call("get", token, base(wsB, pb, "statuses")),
          await call("post", token, base(wsB, pb, "statuses"), { name: "Hacked", type: "active", color: "#112233" }),
          await call("get", token, base(wsB, pb, "categories")),
          await call("post", token, base(wsB, pb, "categories"), { name: "Hacked" }),
          await call("get", token, base(wsB, pb, "faq")),
          await call("post", token, `${base(wsB, pb, "faq")}/categories`, { name: "Hacked" }),
          // B's ids under A's own product slug
          await call("patch", token, `${base(wsA, p1, "statuses")}/${b.planned}`, { name: "Hacked" }),
          await call("put", token, `${base(wsA, p1, "statuses")}/${b.planned}/default`),
          await call("delete", token, `${base(wsA, p1, "statuses")}/${b.planned}?moveTo=${seeded[p1.id].open}`),
          await call("delete", token, `${base(wsA, p1, "statuses")}/${seeded[p1.id].planned}?moveTo=${b.open}`),
          await call("patch", token, `${base(wsA, p1, "categories")}/${b.category}`, { name: "Hacked" }),
          await call("delete", token, `${base(wsA, p1, "categories")}/${b.category}`),
          await call("patch", token, `${base(wsA, p1, "faq")}/categories/${b.faqCategory}`, { name: "Hacked" }),
          await call("delete", token, `${base(wsA, p1, "faq")}/categories/${b.faqCategory}`),
          await call("patch", token, `${base(wsA, p1, "faq")}/questions/${b.faqQuestion}`, { question: "Hacked question?" }),
          await call("patch", token, `${base(wsA, p1, "faq")}/questions/${b.faqQuestion}/reorder`, { targetRank: "a5" }),
          await call("delete", token, `${base(wsA, p1, "faq")}/questions/${b.faqQuestion}`),
          await call("post", token, `${base(wsA, p1, "faq")}/questions`, { categoryId: b.faqCategory, question: "Cross question?", answer }),
        ];
        for (const [i, res] of calls.entries()) {
          expect(res.status, `case ${i}: ${JSON.stringify(res.body)}`).toBe(404);
          expect(res.body.code, `case ${i}`).toMatch(/not_found|category_not_found|question_not_found/);
        }
        expect({ s: await statusRows(pb.id), c: await categoryRows(pb.id), f: await faqRows(pb.id) }).toEqual(before);
        // and A's own planned status survived the cross-delete attempt
        expect((await statusRows(p1.id)).map((r) => r.id)).toContain(seeded[p1.id].planned);
      });
    });
  });
});
