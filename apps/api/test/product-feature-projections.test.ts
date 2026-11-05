import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Disabled module public projections", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let owner: { cookie: string; userId: string };
  let roadmapId: string;
  const admin = "/api/v1/workspaces/projections/products/app";
  const portal = "/api/v1/portal/projections/app";
  const change = async (features: object) => {
    const res = await request(app.http).patch(admin).set("Cookie", owner.cookie)
      .set("Origin", app.env.PUBLIC_URL).send({ features });
    expect(res.status).toBe(200);
  };
  const get = (path: string) => request(app.http).get(path);

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signedInCookie(app.test, { name: "Owner", email: "owner@projections.test", emailVerified: true });
    const [ws] = await app.db.insert(schema.workspaces).values({ name: "Projections", slug: "projections" }).returning();
    await app.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: owner.userId, role: "owner" });
    const [product] = await app.db.insert(schema.products).values({ workspaceId: ws.id, name: "App", slug: "app" }).returning();
    const [status] = await app.db.insert(schema.statuses).values({ productId: product.id, name: "Public planned", type: "planned", color: "#123456", position: 0, isPublicRoadmap: true }).returning();
    const [item] = await app.db.insert(schema.roadmapItems).values({ productId: product.id, statusId: status.id, publicTitle: "ROADMAP_TITLE_CANARY", publicDescription: "Roadmap description", isPublic: true, rank: "a0" }).returning();
    roadmapId = item.id;
    await app.db.insert(schema.roadmapItemInternals).values({ productId: product.id, itemId: item.id, internalTitle: "INTERNAL_CANARY" });
    await app.db.insert(schema.posts).values({ productId: product.id, number: 1, title: "BOARD_TITLE_CANARY", authorId: owner.userId, statusId: status.id, roadmapItemId: item.id, voteCount: 7 });
  });
  afterAll(async () => { await app?.close(); });

  it("hides a linked Roadmap title from public requests while retaining admin detail and restoring the same link", async () => {
    const before = await get(`${portal}/posts/1`);
    expect(before.status).toBe(200);
    expect(before.body.post.roadmapItem).toEqual({ id: roadmapId, title: "ROADMAP_TITLE_CANARY" });
    await change({ roadmap: false });
    for (const cookie of [undefined, owner.cookie]) {
      let req = get(`${portal}/posts/1`);
      if (cookie) req = req.set("Cookie", cookie);
      const hidden = await req;
      expect(hidden.status).toBe(200);
      expect(hidden.body.post.roadmapItem).toBeNull();
      expect(JSON.stringify(hidden.body)).not.toMatch(/ROADMAP_TITLE_CANARY|INTERNAL_CANARY/);
    }
    const privateDetail = await get(`${admin}/posts/1`).set("Cookie", owner.cookie);
    expect(privateDetail.status).toBe(200);
    expect(privateDetail.body.post.roadmapItem).toEqual(before.body.post.roadmapItem);
    await change({ roadmap: true });
    expect((await get(`${portal}/posts/1`)).body.post.roadmapItem).toEqual(before.body.post.roadmapItem);
  });
});
