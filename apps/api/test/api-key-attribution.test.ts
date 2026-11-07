import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { ApiKeyService } from "../src/api-keys/api-key.service.js";

describe("API key attribution on status changes (quick-261107-flq)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let statusDefaultId: string;
  let statusOtherId: string;
  let keyToken: string;
  let keyId: string;
  const bodies: string[] = [];

  const base = () => `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts`;
  const record = (res: { body: unknown }) => {
    bodies.push(JSON.stringify(res.body));
    return res;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await signedInCookie(testApp.test, {
      name: "Attribution Admin",
      email: `attr-admin-${Date.now()}@userhq.test`,
      emailVerified: true,
    });
    wsSlug = `ws-attr-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({ name: "Attribution Workspace", slug: wsSlug })
      .returning();
    wsId = ws.id;
    await testApp.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: wsId, userId: admin.userId, role: "owner" });
    prodSlug = `prod-attr-${Date.now()}`;
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({ workspaceId: wsId, name: "Attribution Product", slug: prodSlug })
      .returning();
    prodId = prod.id;
    const [s1] = await testApp.db
      .insert(schema.statuses)
      .values({ productId: prodId, name: "Under Review", color: "#F59E0B", type: "review", isDefault: true, position: 0 })
      .returning();
    const [s2] = await testApp.db
      .insert(schema.statuses)
      .values({ productId: prodId, name: "Planned", color: "#3B82F6", type: "planned", isDefault: false, position: 1 })
      .returning();
    statusDefaultId = s1.id;
    statusOtherId = s2.id;

    const created = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Attribution Key", scopes: ["requests:write", "requests:read"] });
    keyToken = created.body.token;
    keyId = created.body.key.id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  async function humanPost(title: string) {
    const res = await request(testApp.http)
      .post(base())
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title, description: "A human submitted request" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.number as number;
  }

  async function version(number: number) {
    const res = await request(testApp.http)
      .get(`${base()}/${number}`)
      .set("Authorization", `Bearer ${keyToken}`);
    expect(res.status).toBe(200);
    return res.body.post.version as number;
  }

  async function activityRows(number: number) {
    const [post] = await testApp.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(eq(schema.posts.number, number));
    const rows = await testApp.db
      .select()
      .from(schema.postActivity)
      .where(eq(schema.postActivity.postId, post.id));
    return rows;
  }

  it("records the key on post_activity and returns source for a key status change", async () => {
    const number = await humanPost("Status change through a key");
    const v = await version(number);
    const res = record(
      await request(testApp.http)
        .put(`${base()}/${number}/status`)
        .set("Authorization", `Bearer ${keyToken}`)
        .send({ statusId: statusOtherId, version: v })
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.activity.source).toEqual({ kind: "integration", name: "Attribution Key" });
    expect(res.body.activity.actor.name).toBe("Attribution Key (integration)");
    expect(JSON.stringify(res.body)).not.toContain("apiKeyId");
    expect(JSON.stringify(res.body)).not.toContain(keyId);

    const rows = await activityRows(number);
    expect(rows).toHaveLength(1);
    expect(rows[0].apiKeyId).toBe(keyId);
    expect(rows[0].actorId).toBe(`integration:${keyId}`);
  });

  it("records null for a signed-in human status change", async () => {
    const number = await humanPost("Status change by a human");
    const v = await version(number);
    const res = record(
      await request(testApp.http)
        .put(`${base()}/${number}/status`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ statusId: statusOtherId, version: v })
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.activity.source).toBeNull();
    const rows = await activityRows(number);
    expect(rows).toHaveLength(1);
    expect(rows[0].apiKeyId).toBeNull();
    expect(rows[0].actorId).toBe(admin.userId);
  });

  it("a repeated status is a no-op with no activity row", async () => {
    const number = await humanPost("Status no-op");
    const v = await version(number);
    const res = record(
      await request(testApp.http)
        .put(`${base()}/${number}/status`)
        .set("Authorization", `Bearer ${keyToken}`)
        .send({ statusId: statusDefaultId, version: v })
    );
    expect(res.status).toBe(200);
    expect(res.body.activity).toBeNull();
    expect(await activityRows(number)).toHaveLength(0);
  });

  it("never returns the key token or hash", () => {
    const hash = ApiKeyService.hashToken(keyToken);
    for (const body of bodies) {
      expect(body).not.toContain(keyToken);
      expect(body).not.toContain(hash);
    }
  });
});
