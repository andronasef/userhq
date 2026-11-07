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

describe("integration source across DTOs (quick-261107-flq)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let statusDefaultId: string;
  let statusOtherId: string;
  let token: string;
  let keyId: string;
  let roadmapToken: string;
  let roadmapKeyId: string;
  const bodies: string[] = [];

  const base = () => `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts`;
  const asKey = (t = token) => ({ Authorization: `Bearer ${t}` });
  const asAdmin = () => ({ Cookie: admin.cookie, Origin: testApp.env.PUBLIC_URL });
  const seen = <T extends { body: unknown }>(res: T): T => {
    bodies.push(JSON.stringify(res.body));
    return res;
  };

  let keyPostNumber: number;
  let humanPostNumber: number;
  let keyCommentId: string;
  let humanCommentId: string;
  let keyReplyId: string;
  let keyCommentResponse: any;
  let keyReplyResponse: any;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await signedInCookie(testApp.test, {
      name: "Source Admin",
      email: `src-admin-${Date.now()}@userhq.test`,
      emailVerified: true,
    });
    wsSlug = `ws-src-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({ name: "Source Workspace", slug: wsSlug })
      .returning();
    wsId = ws.id;
    await testApp.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: wsId, userId: admin.userId, role: "owner" });
    prodSlug = `prod-src-${Date.now()}`;
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({ workspaceId: wsId, name: "Source Product", slug: prodSlug })
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

    const mint = async (name: string, scopes: string[]) => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
        .set(asAdmin())
        .send({ name, scopes });
      return { token: res.body.token as string, id: res.body.key.id as string };
    };
    ({ token, id: keyId } = await mint("Source Key", [
      "requests:read",
      "requests:write",
      "comments:read",
      "comments:write",
    ]));
    ({ token: roadmapToken, id: roadmapKeyId } = await mint("Roadmap Key", ["roadmap:write"]));

    // Content: a key post and a human post, each with a comment, plus a key reply to the human comment.
    const kp = seen(
      await request(testApp.http).post(base()).set(asKey()).send({ title: "Made by the key", description: "Integration request" })
    );
    expect(kp.status, JSON.stringify(kp.body)).toBe(201);
    keyPostNumber = kp.body.number;
    const hp = seen(
      await request(testApp.http).post(base()).set(asAdmin()).send({ title: "Made by a human", description: "Human request" })
    );
    expect(hp.status).toBe(201);
    humanPostNumber = hp.body.number;

    keyCommentResponse = seen(
      await request(testApp.http).post(`${base()}/${keyPostNumber}/comments`).set(asKey()).send({ body: "Key comment" })
    );
    expect(keyCommentResponse.status, JSON.stringify(keyCommentResponse.body)).toBe(201);
    keyCommentId = keyCommentResponse.body.id;
    const hc = seen(
      await request(testApp.http).post(`${base()}/${humanPostNumber}/comments`).set(asAdmin()).send({ body: "Human comment" })
    );
    expect(hc.status).toBe(201);
    humanCommentId = hc.body.id;
    keyReplyResponse = seen(
      await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/comments/${humanCommentId}/reply`).set(asKey()).send({ body: "Key reply" })
    );
    expect(keyReplyResponse.status, JSON.stringify(keyReplyResponse.body)).toBe(201);
    keyReplyId = keyReplyResponse.body.id;

    // Status change by the key on the human post, by the human on the key post.
    const hv = await request(testApp.http).get(`${base()}/${humanPostNumber}`).set(asKey());
    const k1 = seen(
      await request(testApp.http).put(`${base()}/${humanPostNumber}/status`).set(asKey()).send({ statusId: statusOtherId, version: hv.body.post.version })
    );
    expect(k1.status, JSON.stringify(k1.body)).toBe(200);
    const kv = await request(testApp.http).get(`${base()}/${keyPostNumber}`).set(asKey());
    const k2 = seen(
      await request(testApp.http).put(`${base()}/${keyPostNumber}/status`).set(asAdmin()).send({ statusId: statusOtherId, version: kv.body.post.version })
    );
    expect(k2.status, JSON.stringify(k2.body)).toBe(200);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const publicSource = { kind: "integration", name: "Source Key" };
  const adminSource = () => ({ kind: "integration", name: "Source Key", apiKeyId: keyId });

  function findComment(timeline: any[], id: string) {
    for (const item of timeline) {
      if (item.kind === "comment") {
        if (item.comment.id === id) return item.comment;
        const r = item.replies.find((x: any) => x.id === id);
        if (r) return r;
      }
    }
    return undefined;
  }

  it("admin post detail shows source for key content and null for human content, author stays the integration actor", async () => {
    const k = seen(await request(testApp.http).get(`${base()}/${keyPostNumber}`).set(asAdmin()));
    expect(k.status).toBe(200);
    expect(k.body.post.source).toEqual(publicSource);
    expect(k.body.post.author.name).toBe("Source Key (integration)");
    // The human status change on this post legitimately names the admin; the key-made post and comment must not.
    expect(JSON.stringify([k.body.post, findComment(k.body.timeline, keyCommentId)])).not.toContain("Source Admin");

    const h = seen(await request(testApp.http).get(`${base()}/${humanPostNumber}`).set(asAdmin()));
    expect(h.body.post.source).toBeNull();
    expect(h.body.post.author.name).toBe("Source Admin");
  });

  it("timeline comments and replies carry source; human comments carry null", async () => {
    const kp = seen(await request(testApp.http).get(`${base()}/${keyPostNumber}`).set(asAdmin()));
    expect(findComment(kp.body.timeline, keyCommentId).source).toEqual(publicSource);
    const hp = seen(await request(testApp.http).get(`${base()}/${humanPostNumber}`).set(asAdmin()));
    expect(findComment(hp.body.timeline, humanCommentId).source).toBeNull();
    expect(findComment(hp.body.timeline, keyReplyId).source).toEqual(publicSource);
  });

  it("write responses carry source: createComment public shape, reply admin shape", () => {
    expect(keyCommentResponse.body.source).toEqual(publicSource);
    expect(keyReplyResponse.body.source).toEqual(adminSource());
    expect(keyReplyResponse.body.author.name).toBe("Source Key (integration)");
  });

  it("timeline activity carries source for a key status change and null for a human one", async () => {
    const hp = seen(await request(testApp.http).get(`${base()}/${humanPostNumber}`).set(asAdmin()));
    const keyActivity = hp.body.timeline.find((i: any) => i.kind === "activity");
    expect(keyActivity.activity.source).toEqual(publicSource);
    const kp = seen(await request(testApp.http).get(`${base()}/${keyPostNumber}`).set(asAdmin()));
    const humanActivity = kp.body.timeline.find((i: any) => i.kind === "activity");
    expect(humanActivity.activity.source).toBeNull();
  });

  it("the anonymous portal shows the key name but never the key id", async () => {
    const kp = seen(await request(testApp.http).get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${keyPostNumber}`));
    expect(kp.status, JSON.stringify(kp.body)).toBe(200);
    expect(kp.body.post.source).toEqual(publicSource);
    expect(findComment(kp.body.timeline, keyCommentId).source).toEqual(publicSource);
    const hp = seen(await request(testApp.http).get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${humanPostNumber}`));
    const text = JSON.stringify(hp.body) + JSON.stringify(kp.body);
    expect(text).toContain("Source Key");
    expect(text).not.toContain(keyId);
    expect(text).not.toContain("apiKeyId");
    expect(hp.body.timeline.find((i: any) => i.kind === "activity").activity.source).toEqual(publicSource);
    expect(hp.body.post.source).toBeNull();
  });

  it("admin-shaped DTOs add apiKeyId: board rows, requests and comments inbox", async () => {
    const board = seen(await request(testApp.http).get(base()).set(asAdmin()));
    const row = (n: number) => board.body.posts.find((p: any) => p.number === n);
    expect(row(keyPostNumber).source).toEqual(adminSource());
    expect(row(humanPostNumber).source).toBeNull();

    const reqs = seen(await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/requests`).set(asAdmin()));
    const item = (n: number) => reqs.body.items.find((p: any) => p.number === n);
    expect(item(keyPostNumber).source).toEqual(adminSource());
    expect(item(humanPostNumber).source).toBeNull();

    const inbox = seen(
      await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/comments?attention=all`).set(asAdmin())
    );
    const c = (id: string) => inbox.body.items.find((x: any) => x.id === id);
    expect(c(keyCommentId).source).toEqual(adminSource());
    expect(c(keyReplyId).source).toEqual(adminSource());
    expect(c(humanCommentId).source).toBeNull();
  });

  it("roadmap cascades record the key; the same move by a human records null", async () => {
    const mk = async (title: string) => {
      const res = await request(testApp.http).post(base()).set(asAdmin()).send({ title, description: "roadmap target" });
      const all = await testApp.db.select({ id: schema.posts.id, number: schema.posts.number }).from(schema.posts).where(eq(schema.posts.productId, prodId));
      return all.find((p) => p.number === res.body.number)!;
    };
    const item = seen(
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
        .set(asAdmin())
        .send({ statusId: statusOtherId, internalTitle: "Cascade item", isPublic: false })
    );
    expect(item.status, JSON.stringify(item.body)).toBe(201);
    const byKey = await mk("Linked by key");
    const byHuman = await mk("Linked by human");
    const roadmapBase = `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${item.body.id}/link`;
    const l1 = await request(testApp.http).post(roadmapBase).set(asKey(roadmapToken)).send({ postId: byKey.id });
    expect(l1.status, JSON.stringify(l1.body)).toBe(201);
    const l2 = await request(testApp.http).post(roadmapBase).set(asAdmin()).send({ postId: byHuman.id });
    expect(l2.status, JSON.stringify(l2.body)).toBe(201);

    const rows = async (postId: string) =>
      testApp.db.select().from(schema.postActivity).where(eq(schema.postActivity.postId, postId));
    const a1 = await rows(byKey.id);
    expect(a1).toHaveLength(1);
    expect(a1[0].apiKeyId).toBe(roadmapKeyId);
    expect(a1[0].actorId).toBe(`integration:${roadmapKeyId}`);
    const a2 = await rows(byHuman.id);
    expect(a2).toHaveLength(1);
    expect(a2[0].apiKeyId).toBeNull();
    expect(a2[0].actorId).toBe(admin.userId);
  });

  it("never returns the key token or hash", () => {
    for (const t of [token, roadmapToken]) {
      const hash = ApiKeyService.hashToken(t);
      for (const body of bodies) {
        expect(body).not.toContain(t);
        expect(body).not.toContain(hash);
      }
    }
  });
});
