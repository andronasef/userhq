import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import request from "supertest";
import { eq, and, sql } from "drizzle-orm";
import { schema } from "@userhq/db";
import { postSlug } from "@userhq/types";
import webpush from "web-push";
import { OutboundHttp } from "../src/common/outbound-http.js";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { PushService } from "../src/push/push.service.js";
import { PushWorker } from "../src/push/push.worker.js";
import https from "node:https";
import { readFileSync } from "node:fs";
import { createECDH, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { fixtureOutboundNetwork } from "./support/outbound-network.js";

describe("Browser Web Push Notifications (Slice 8 / Phase 11)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string; name: string };
  let userB: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let statusId: string;
  let statusClosedId: string;
  let pushService: PushService;
  let pushWorker: PushWorker;

  beforeAll(async () => {
    testApp = await createTestApp();
    pushService = testApp.app.get(PushService);
    pushWorker = testApp.app.get(PushWorker);

    userA = await signedInCookie(testApp.test, {
      name: "User Alice",
      email: "alice@push.test",
      emailVerified: true,
    });

    userB = await signedInCookie(testApp.test, {
      name: "User Bob",
      email: "bob@push.test",
      emailVerified: true,
    });

    // Create workspace and product
    wsSlug = `ws-push-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Push Workspace",
        slug: wsSlug,
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = "push-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Push Product",
        slug: prodSlug,
        boardEnabled: true,
      })
      .returning();
    prodId = prod.id;

    const [stOpen] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Open",
        color: "#3B82F6",
        type: "review",
        isDefault: true,
        position: 0,
      })
      .returning();
    statusId = stOpen.id;

    const [stClosed] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Completed",
        color: "#22C55E",
        type: "completed",
        isDefault: false,
        position: 1,
      })
      .returning();
    statusClosedId = stClosed.id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("rejects private push endpoints before registering a subscription", async () => {
    const res = await request(testApp.http).post("/api/v1/push/subscriptions")
      .set("Cookie", userA.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ endpoint: "https://127.0.0.1/internal", keys: { p256dh: "test-key", auth: "test-auth" } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_url");
  });

  it("exposes VAPID public key endpoint", async () => {
    const res = await request(testApp.http)
      .get("/api/v1/push/vapid-public-key")
      .expect(200);

    expect(res.body).toHaveProperty("publicKey");
    expect(typeof res.body.publicKey).toBe("string");
    expect(res.body.publicKey.length).toBeGreaterThan(10);
  });

  it("manages push subscriptions with idempotency and deletion", async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/test-token-${Date.now()}`;
    const subPayload = {
      endpoint,
      keys: {
        p256dh: "BMaK...dummyP256dhKey1234567890abcdef...",
        auth: "dummyAuthKey1234567890==",
      },
      userAgent: "Mozilla/5.0 TestBrowser",
    };

    // Register subscription
    const regRes = await request(testApp.http)
      .post("/api/v1/push/subscriptions")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send(subPayload)
      .expect(201);

    expect(regRes.body).toMatchObject({
      endpoint,
      userAgent: "Mozilla/5.0 TestBrowser",
    });
    expect(regRes.body.id).toBeDefined();

    // Idempotent re-register with updated user agent
    const reRegRes = await request(testApp.http)
      .post("/api/v1/push/subscriptions")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        ...subPayload,
        userAgent: "UpdatedBrowser/2.0",
      })
      .expect(201);

    expect(reRegRes.body.id).toBe(regRes.body.id);

    // Unregister subscription
    await request(testApp.http)
      .delete("/api/v1/push/subscriptions")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ endpoint })
      .expect(200);

    const check = await testApp.db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));
    expect(check.length).toBe(0);
  });

  it("manages push notification preferences (defaults, updates, includePreviews)", async () => {
    // Default preferences
    const getRes = await request(testApp.http)
      .get("/api/v1/push/preferences")
      .set("Cookie", userB.cookie)
      .expect(200);

    expect(getRes.body).toMatchObject({
      enabled: true,
      includePreviews: false, // D-02 default generic
      notifyReplies: true,
      notifyStatusChanges: true,
      notifyNewPosts: true,
      notifyNewComments: true,
    });

    // Update preferences
    const patchRes = await request(testApp.http)
      .patch("/api/v1/push/preferences")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        includePreviews: true,
        notifyReplies: false,
      })
      .expect(200);

    expect(patchRes.body.includePreviews).toBe(true);
    expect(patchRes.body.notifyReplies).toBe(false);
    expect(patchRes.body.enabled).toBe(true);
  });

  it("follows and unfollows products for new post/comment notifications", async () => {
    // Follow product
    await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/push-follow`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .expect(200);

    // List followed products
    const listRes = await request(testApp.http)
      .get("/api/v1/push/followed-products")
      .set("Cookie", userA.cookie)
      .expect(200);

    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: prodId,
          productSlug: prodSlug,
          workspaceSlug: wsSlug,
        }),
      ])
    );

    // Unfollow product
    await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/push-follow`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .expect(200);

    const listAfterRes = await request(testApp.http)
      .get("/api/v1/push/followed-products")
      .set("Cookie", userA.cookie)
      .expect(200);

    expect(listAfterRes.body.some((p: any) => p.productId === prodId)).toBe(false);
  });

  it("enqueues push delivery on status change and respects generic title/body when includePreviews is false", async () => {
    // Register subscription for userB
    const bEndpoint = `https://fcm.googleapis.com/fcm/send/user-b-${Date.now()}`;
    await request(testApp.http)
      .post("/api/v1/push/subscriptions")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        endpoint: bEndpoint,
        keys: {
          p256dh: "BFakeKeyP256dh1234567890abcdef...",
          auth: "fakeAuth123456789==",
        },
      })
      .expect(201);

    // Ensure userB preferences has includePreviews = false
    await request(testApp.http)
      .patch("/api/v1/push/preferences")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        enabled: true,
        includePreviews: false,
        notifyStatusChanges: true,
      })
      .expect(200);

    // UserB creates a post in the product
    const createPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Test Push Feature Request",
        description: "Details for push notification testing",
      })
      .expect(201);

    const postNumber = createPostRes.body.number;

    // UserA (admin) updates status of the post
    await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: statusClosedId,
        version: 1,
      })
      .expect(200);

    // Verify outbox push delivery was enqueued for userB
    const deliveries = await testApp.db
      .select()
      .from(schema.pushDeliveries)
      .where(
        and(
          eq(schema.pushDeliveries.userId, userB.userId),
          eq(schema.pushDeliveries.eventType, "status_change")
        )
      );

    expect(deliveries.length).toBeGreaterThan(0);
    const delivery = deliveries[0];
    // Generic text per D-02 since includePreviews = false
    expect(delivery.title).toBe("Feedback status updated");
    expect(delivery.body).toBe("A post you follow has an updated status.");
    expect(delivery.url).toBe(`/${wsSlug}/${prodSlug}/p/${postNumber}-${postSlug("Test Push Feature Request")}`);
    expect(delivery.status).toBe("pending");
  });

  it("enqueues preview text when includePreviews is true", async () => {
    // Turn on includePreviews for userB
    await request(testApp.http)
      .patch("/api/v1/push/preferences")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        includePreviews: true,
      })
      .expect(200);

    // UserB creates another post
    const postRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Specific Preview Post Title",
      })
      .expect(201);

    const postNumber = postRes.body.number;

    // UserA changes status to Completed
    await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: statusClosedId,
        version: 1,
      })
      .expect(200);

    const deliveries = await testApp.db
      .select()
      .from(schema.pushDeliveries)
      .where(
        and(
          eq(schema.pushDeliveries.userId, userB.userId),
          eq(schema.pushDeliveries.eventType, "status_change")
        )
      );

    // Find the latest delivery
    const latest = deliveries[deliveries.length - 1];
    expect(latest.title).toContain("Specific Preview Post Title");
    expect(latest.body).toContain("Completed");
  });

  it("enqueues reply push notification when someone comments on user's post", async () => {
    // Ensure notifyReplies is true for userB
    await request(testApp.http)
      .patch("/api/v1/push/preferences")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        notifyReplies: true,
      })
      .expect(200);

    // UserB has a post
    const postRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Commentable Post",
      })
      .expect(201);

    const postNumber = postRes.body.number;

    // UserA comments on userB's post
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        body: "Here is a helpful comment reply!",
      })
      .expect(201);

    const deliveries = await testApp.db
      .select()
      .from(schema.pushDeliveries)
      .where(
        and(
          eq(schema.pushDeliveries.userId, userB.userId),
          eq(schema.pushDeliveries.eventType, "comment_reply")
        )
      );

    expect(deliveries.length).toBeGreaterThan(0);
    const latest = deliveries[deliveries.length - 1];
    expect(latest.url).toBe(`/${wsSlug}/${prodSlug}/p/${postNumber}-${postSlug("Commentable Post")}`);
    // userB has includePreviews: true from previous test
    expect(latest.title).toContain("User Alice");
    expect(latest.body).toContain("Here is a helpful comment reply!");
  });

  it("enqueues new post push notification to admin followers of a product", async () => {
    // A third user is made a workspace admin and follows the product through the guarded route.
    const userC = await signedInCookie(testApp.test, {
      name: "User Carol",
      email: "carol@push.test",
      emailVerified: true,
    });
    await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: userC.userId, role: "admin" });
    await request(testApp.http)
      .post("/api/v1/push/subscriptions")
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        endpoint: `https://fcm.googleapis.com/fcm/send/user-c-${Date.now()}`,
        keys: { p256dh: "BFakeKeyP256dh1234567890abcdef...", auth: "fakeAuth123456789==" },
      })
      .expect(201);
    await request(testApp.http)
      .patch("/api/v1/push/preferences")
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ includePreviews: true })
      .expect(200);
    await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/push-follow`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .expect(200);

    // UserA creates a new post in the product
    const postRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Announcing Feature X",
      })
      .expect(201);

    const postNumber = postRes.body.number;

    const deliveries = await testApp.db
      .select()
      .from(schema.pushDeliveries)
      .where(
        and(
          eq(schema.pushDeliveries.userId, userC.userId),
          eq(schema.pushDeliveries.eventType, "new_post")
        )
      );

    expect(deliveries.length).toBeGreaterThan(0);
    const latest = deliveries[deliveries.length - 1];
    expect(latest.url).toBe(`/${wsSlug}/${prodSlug}/p/${postNumber}-${postSlug("Announcing Feature X")}`);
    expect(latest.title).toContain("Push Product");
  });

  it("handles test push notification dispatch", async () => {
    const testRes = await request(testApp.http)
      .post("/api/v1/push/test")
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .expect(200);

    expect(testRes.body.success).toBe(true);
    expect(testRes.body.enqueuedCount).toBeGreaterThanOrEqual(1);
  });
});

describe("Push delivery network safety", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let owner: Awaited<ReturnType<typeof signedInCookie>>;
  let worker: PushWorker;
  let server: https.Server;
  let port: number;
  let dnsAddress = "8.8.8.8";
  let connections = 0;
  let sequence = 0;
  let redirectStatus = 302;
  const received: Array<{ headers: any; body: Buffer }> = [];
  const ca = readFileSync(new URL("./fixtures/outbound-test-cert.pem", import.meta.url));
  beforeAll(async () => {
    server = https.createServer({ cert: ca, key: readFileSync(new URL("./fixtures/outbound-test-key.pem", import.meta.url)) }, (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks) });
        if (req.url?.startsWith("/stall")) return;
        if (req.url?.startsWith("/redirect")) { res.writeHead(redirectStatus, { Location: "https://127.0.0.1/private" }); res.end(); return; }
        res.statusCode = req.url?.startsWith("/gone") ? 410 : 201;
        res.end();
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    testApp = await createTestApp({ outboundNetwork: {
      ...fixtureOutboundNetwork, deadlineMs: 150,
      resolve: async () => [{ address: dnsAddress, family: 4 }],
      request: (url, options, response) => {
        connections++;
        return https.request(url, { ...options, ca, lookup: (_h, _o, cb) => cb(null, "127.0.0.1", 4) }, response);
      },
    } });
    worker = testApp.app.get(PushWorker);
    owner = await signedInCookie(testApp.test, { name: "Push recipient", email: "network@push.test", emailVerified: true });
    await request(testApp.http).patch("/api/v1/push/preferences")
      .set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL).send({ enabled: true }).expect(200);
  });
  afterAll(async () => {
    await testApp?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  afterEach(async () => {
    dnsAddress = "8.8.8.8";
    redirectStatus = 302;
    await testApp.db.delete(schema.pushSubscriptions);
  });

  async function enqueue(path: string) {
    const ecdh = createECDH("prime256v1");
    const p256dh = ecdh.generateKeys().toString("base64url");
    const registered = await request(testApp.http).post("/api/v1/push/subscriptions")
      .set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ endpoint: `https://receiver.example.test:${port}/${path}-${sequence++}`, keys: { p256dh, auth: randomBytes(16).toString("base64url") } });
    expect(registered.status).toBe(201);
    // Worker/DB boundary: seed one outbox job, rather than enqueuing a test for all subscriptions.
    const [delivery] = await testApp.db.insert(schema.pushDeliveries).values({
      subscriptionId: registered.body.id, userId: owner.userId, eventType: "test",
      title: "Private test title", body: "Private test body",
    }).returning();
    return { subscriptionId: registered.body.id as string, deliveryId: delivery.id };
  }
  async function delivery(id: string) {
    const [row] = await testApp.db.select().from(schema.pushDeliveries).where(eq(schema.pushDeliveries.id, id));
    return row;
  }

  it("delivers encrypted push through the shared HTTPS boundary", async () => {
    const item = await enqueue("ok");
    await worker.processPending();
    expect((await delivery(item.deliveryId)).status).toBe("delivered");
    expect(connections).toBe(1);
    expect(received[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(received[0].headers.authorization).toMatch(/^vapid /);
    expect(received[0].body.length).toBeGreaterThan(50);
    expect(received[0].body.toString()).not.toContain("Private test title");
  });

  it("rejects a stored push target that resolves privately at delivery time", async () => {
    const item = await enqueue("private");
    const before = connections;
    dnsAddress = "169.254.169.254";
    await worker.processPending();
    expect(connections).toBe(before);
    expect(await delivery(item.deliveryId)).toMatchObject({ status: "pending", attempts: 1, errorMessage: "Outbound destination rejected" });
  });

  it("does not follow a push redirect and retries successfully later", async () => {
    const item = await enqueue("redirect");
    const before = connections;
    await worker.processPending();
    expect(connections).toBe(before + 1);
    expect(await delivery(item.deliveryId)).toMatchObject({ status: "pending", attempts: 1, errorMessage: "HTTP 302" });
    redirectStatus = 201;
    await testApp.db.update(schema.pushDeliveries).set({ nextAttemptAt: new Date(0) }).where(eq(schema.pushDeliveries.id, item.deliveryId));
    await worker.processPending();
    expect(await delivery(item.deliveryId)).toMatchObject({ status: "delivered", attempts: 2, errorMessage: null });
  });

  it("bounds a stalled push endpoint so the next delivery proceeds", async () => {
    const stalled = await enqueue("stall");
    const later = await enqueue("ok");
    await worker.processPending();
    expect(await delivery(stalled.deliveryId)).toMatchObject({ status: "pending", errorMessage: "Outbound delivery timed out" });
    expect((await delivery(later.deliveryId)).status).toBe("delivered");
  });

  it("removes expired subscriptions on HTTP 410", async () => {
    const item = await enqueue("gone");
    await worker.processPending();
    const subscriptions = await testApp.db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, item.subscriptionId));
    expect(subscriptions).toHaveLength(0);
  });
});

describe("Push notification path: canonical URL, tag, Board lock and cleanup (D-10, D-14)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let owner: Awaited<ReturnType<typeof signedInCookie>>;
  let customer: Awaited<ReturnType<typeof signedInCookie>>;
  let pushService: PushService;
  let worker: PushWorker;
  let wsId: string;
  const wsSlug = "ws-path";
  let prod: { id: string; slug: string };
  let otherProd: { id: string; slug: string };
  let post: { id: string; number: number };
  let otherPost: { id: string };
  let sub: { id: string };
  let otherSub: { id: string };

  const latch = () => {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => { release = resolve; });
    return { promise, release };
  };

  async function seedSub(userId: string, host: string) {
    const ecdh = createECDH("prime256v1");
    const [row] = await testApp.db.insert(schema.pushSubscriptions).values({
      userId, endpoint: `https://${host}.example.test/push`,
      p256dh: ecdh.generateKeys().toString("base64url"), auth: randomBytes(16).toString("base64url"),
    }).returning();
    return row;
  }
  const statusOpts = () => ({
    workspaceId: wsId, productId: prod.id, postId: post.id, actorId: owner.userId,
    postTitle: "Path Post", newStatusName: "Done", productSlug: prod.slug, workspaceSlug: wsSlug, postNumber: post.number,
  });
  const rowsFor = (productId: string) =>
    testApp.db.select().from(schema.pushDeliveries).where(sql`${schema.pushDeliveries.data}->>'productId' = ${productId}`);

  beforeAll(async () => {
    testApp = await createTestApp();
    pushService = testApp.app.get(PushService);
    worker = testApp.app.get(PushWorker);
    owner = await signedInCookie(testApp.test, { name: "Path Owner", email: "path-owner@push.test", emailVerified: true });
    customer = await signedInCookie(testApp.test, { name: "Path Customer", email: "path-customer@push.test", emailVerified: true });
    const [ws] = await testApp.db.insert(schema.workspaces).values({ name: "Path WS", slug: wsSlug }).returning();
    wsId = ws.id;
    await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: owner.userId, role: "owner" });
    const mk = async (slug: string) => {
      const [p] = await testApp.db.insert(schema.products).values({ workspaceId: wsId, name: slug, slug }).returning();
      const [st] = await testApp.db.insert(schema.statuses).values({ productId: p.id, name: "Open", color: "#123456", type: "review", position: 0, isDefault: true }).returning();
      const [po] = await testApp.db.insert(schema.posts).values({ productId: p.id, number: 7, title: "Path Post", authorId: customer.userId, statusId: st.id }).returning();
      return { p, po };
    };
    const a = await mk("path-a");
    const b = await mk("path-b");
    prod = a.p; post = a.po; otherProd = b.p; otherPost = b.po;
    sub = await seedSub(customer.userId, "path-sub");
    otherSub = await seedSub(customer.userId, "path-other");
  });
  afterAll(async () => { await testApp?.close(); });
  beforeEach(async () => {
    await testApp.db.delete(schema.pushDeliveries);
    await testApp.db.update(schema.products).set({ boardEnabled: true, deletedAt: null }).where(eq(schema.products.workspaceId, wsId));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const toggle = (board: boolean) => request(testApp.http).patch(`/api/v1/workspaces/${wsSlug}/products/${prod.slug}`)
    .set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL).send({ features: { board } });

  it("uses the bare post path when the title slugifies to nothing", async () => {
    await testApp.db.update(schema.posts).set({ title: "!!!" }).where(eq(schema.posts.id, post.id));
    try {
      await testApp.db.transaction((tx) => pushService.enqueueStatusChangePush(tx, { ...statusOpts(), postTitle: "!!!" }));
    } finally {
      await testApp.db.update(schema.posts).set({ title: "Path Post" }).where(eq(schema.posts.id, post.id));
    }
    const [row] = await rowsFor(prod.id);
    expect(row.url).toBe(`/${wsSlug}/${prod.slug}/p/${post.number}`);
  });

  it("carries the canonical url, per-post tag and renotify in the encrypted payload; test events carry neither", async () => {
    await testApp.db.transaction((tx) => pushService.enqueueStatusChangePush(tx, statusOpts()));
    await testApp.db.insert(schema.pushDeliveries).values({
      subscriptionId: sub.id, userId: customer.userId, eventType: "test", title: "t", body: "b", data: { test: true },
    });
    const posts: string[] = [];
    const real = webpush.generateRequestDetails.bind(webpush);
    vi.spyOn(webpush, "generateRequestDetails").mockImplementation(((s: any, payload: string) => { posts.push(payload); return real(s, payload); }) as any);
    vi.spyOn(testApp.app.get(OutboundHttp), "post").mockResolvedValue({ statusCode: 201, body: "" } as any);
    await worker.processPending();
    expect(posts).toHaveLength(3); // two status rows (two subscriptions) plus the test row
    const parsed = posts.map((p) => JSON.parse(p));
    const statusPayload = parsed.find((p) => p.data?.postId)!;
    expect(statusPayload.url).toBe(`/${wsSlug}/${prod.slug}/p/${post.number}-${postSlug("Path Post")}`);
    expect(statusPayload.tag).toBe(`post-${post.id}`);
    expect(statusPayload.renotify).toBe(true);
    const testPayload = parsed.find((p) => !p.data?.postId)!;
    expect(testPayload).not.toHaveProperty("tag");
    expect(testPayload).not.toHaveProperty("renotify");
  });

  it("inserts nothing for a Board-disabled, missing or soft-deleted product", async () => {
    await testApp.db.update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, prod.id));
    await testApp.db.transaction((tx) => pushService.enqueueStatusChangePush(tx, statusOpts()));
    await testApp.db.update(schema.products).set({ boardEnabled: true, deletedAt: new Date() }).where(eq(schema.products.id, prod.id));
    await testApp.db.transaction((tx) => pushService.enqueueStatusChangePush(tx, statusOpts()));
    await testApp.db.transaction((tx) => pushService.enqueueStatusChangePush(tx, { ...statusOpts(), productId: "00000000-0000-4000-8000-000000000000" }));
    await testApp.db.update(schema.products).set({ deletedAt: null }).where(eq(schema.products.id, prod.id));
    expect(await testApp.db.select().from(schema.pushDeliveries)).toHaveLength(0);
  });

  it("board disable removes only that product's unsent push rows; re-enable creates nothing", async () => {
    const base = { userId: customer.userId, eventType: "status_change", title: "t", body: "b" };
    const [pending, sending, delivered, failed, testEvent, otherPending] = await testApp.db.insert(schema.pushDeliveries).values([
      { ...base, subscriptionId: sub.id, status: "pending", data: { productId: prod.id, postId: post.id } },
      { ...base, subscriptionId: sub.id, status: "sending", data: { productId: prod.id, postId: post.id } },
      { ...base, subscriptionId: sub.id, status: "delivered", data: { productId: prod.id, postId: post.id } },
      { ...base, subscriptionId: sub.id, status: "failed", data: { productId: prod.id, postId: post.id } },
      { ...base, subscriptionId: sub.id, eventType: "test", status: "pending", data: { test: true } },
      { ...base, subscriptionId: otherSub.id, status: "pending", data: { productId: otherProd.id, postId: otherPost.id } },
    ]).returning();
    expect((await toggle(false)).status).toBe(200);
    const left = (await testApp.db.select({ id: schema.pushDeliveries.id }).from(schema.pushDeliveries)).map((r) => r.id).sort();
    expect(left).toEqual([delivered.id, failed.id, testEvent.id, otherPending.id].sort());
    expect(left).not.toContain(pending.id);
    expect(left).not.toContain(sending.id);
    expect((await toggle(true)).status).toBe(200);
    expect(await testApp.db.select().from(schema.pushDeliveries)).toHaveLength(4);
  });

  it("serializes an in-flight enqueue with a concurrent Board disable", async () => {
    const produced = latch();
    const commit = latch();
    const producer = testApp.db.transaction(async (tx) => {
      await pushService.enqueueStatusChangePush(tx, statusOpts());
      produced.release();
      await commit.promise;
    });
    try {
      await produced.promise;
      let disableFinished = false;
      const disabling = toggle(false).then((res) => { disableFinished = true; return res; });
      // Two valid orderings: disable finishes, or it reaches a real PostgreSQL lock wait on the product row.
      const deadline = Date.now() + 5000;
      while (!disableFinished) {
        const waiting = await testApp.db.execute(sql`
          SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock' AND query ILIKE '%update%products%'
        `);
        if (waiting.rows.length > 0) break;
        if (Date.now() > deadline) throw new Error("Disable neither completed nor reached its product lock");
      }
      commit.release();
      await producer;
      expect((await disabling).status).toBe(200);
      expect((await toggle(true)).status).toBe(200);
      const survivors = (await rowsFor(prod.id)).filter((r) => r.status === "pending" || r.status === "sending");
      expect(survivors).toHaveLength(0);
    } finally {
      commit.release();
      await producer;
    }
  });
});

describe("Admin-only tenant-guarded product follow (D-11)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let pushService: PushService;
  let owner: Awaited<ReturnType<typeof signedInCookie>>;
  let admin: Awaited<ReturnType<typeof signedInCookie>>;
  let customer: Awaited<ReturnType<typeof signedInCookie>>;
  let foreign: Awaited<ReturnType<typeof signedInCookie>>;
  let wsId: string;
  let prodId: string;
  let foreignProdId: string;
  const wsSlug = "ws-follow";
  const prodSlug = "follow-prod";
  const followPath = `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/push-follow`;

  const follows = (productId: string) =>
    testApp.db.select().from(schema.pushFollowedProducts).where(eq(schema.pushFollowedProducts.productId, productId));
  const mut = (method: "post" | "delete", path: string, cookie: string) =>
    request(testApp.http)[method](path).set("Cookie", cookie).set("Origin", testApp.env.PUBLIC_URL);

  beforeAll(async () => {
    testApp = await createTestApp();
    pushService = testApp.app.get(PushService);
    owner = await signedInCookie(testApp.test, { name: "F Owner", email: "f-owner@push.test", emailVerified: true });
    admin = await signedInCookie(testApp.test, { name: "F Admin", email: "f-admin@push.test", emailVerified: true });
    customer = await signedInCookie(testApp.test, { name: "F Customer", email: "f-customer@push.test", emailVerified: true });
    foreign = await signedInCookie(testApp.test, { name: "F Foreign", email: "f-foreign@push.test", emailVerified: true });
    const [ws] = await testApp.db.insert(schema.workspaces).values({ name: "Follow WS", slug: wsSlug }).returning();
    wsId = ws.id;
    await testApp.db.insert(schema.workspaceMembers).values([
      { workspaceId: wsId, userId: owner.userId, role: "owner" },
      { workspaceId: wsId, userId: admin.userId, role: "admin" },
    ]);
    const [prod] = await testApp.db.insert(schema.products).values({ workspaceId: wsId, name: "Follow Product", slug: prodSlug }).returning();
    prodId = prod.id;
    const [fws] = await testApp.db.insert(schema.workspaces).values({ name: "Foreign WS", slug: "ws-follow-foreign" }).returning();
    await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: fws.id, userId: foreign.userId, role: "owner" });
    const [fprod] = await testApp.db.insert(schema.products).values({ workspaceId: fws.id, name: "Foreign Product", slug: "foreign-prod" }).returning();
    foreignProdId = fprod.id;
  });
  afterAll(async () => { await testApp?.close(); });
  beforeEach(async () => { await testApp.db.delete(schema.pushFollowedProducts); await testApp.db.delete(schema.pushDeliveries); });

  it("lets workspace owners and admins follow idempotently, list, and unfollow", async () => {
    for (const who of [owner, admin]) {
      expect((await mut("post", followPath, who.cookie)).body).toEqual({ success: true });
      expect((await mut("post", followPath, who.cookie)).status).toBe(200);
    }
    expect(await follows(prodId)).toHaveLength(2);
    const list = await request(testApp.http).get("/api/v1/push/followed-products").set("Cookie", owner.cookie).expect(200);
    expect(list.body.map((p: any) => p.productId)).toEqual([prodId]);
    expect((await mut("delete", followPath, owner.cookie)).status).toBe(200);
    const left = await follows(prodId);
    expect(left.map((f) => f.userId)).toEqual([admin.userId]);
  });

  it("rejects a non-member customer, a foreign tenant's admin, anonymous callers and API keys without creating a row", async () => {
    const nonMember = await mut("post", followPath, customer.cookie);
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.code).toBe("not_found");

    const crossTenant = await mut("post", `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/push-follow`, foreign.cookie);
    expect(crossTenant.status).toBe(404);
    const reversed = await mut("post", "/api/v1/workspaces/ws-follow-foreign/products/foreign-prod/push-follow", owner.cookie);
    expect(reversed.status).toBe(404);

    const anon = await request(testApp.http).post(followPath).set("Origin", testApp.env.PUBLIC_URL);
    expect(anon.status).toBe(401);

    const key = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Follow policy", scopes: ["admin"] });
    expect(key.status).toBe(201);
    for (const method of ["post", "delete"] as const) {
      const res = await request(testApp.http)[method](followPath).set("Authorization", `Bearer ${key.body.token}`).send({});
      expect(res.status, method).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
    }

    expect(await follows(prodId)).toHaveLength(0);
    expect(await follows(foreignProdId)).toHaveLength(0);
  });

  it("no longer exposes the raw product id follow route", async () => {
    const res = await mut("post", `/api/v1/push/followed-products/${prodId}`, owner.cookie);
    expect(res.status).toBe(404);
    expect(await follows(prodId)).toHaveLength(0);
  });

  it("keeps the user-scoped unfollow limited to the caller's own follow", async () => {
    await testApp.db.insert(schema.pushFollowedProducts).values([
      { userId: owner.userId, productId: prodId },
      { userId: admin.userId, productId: prodId },
    ]);
    expect((await mut("delete", `/api/v1/push/followed-products/${prodId}`, admin.cookie)).status).toBe(200);
    expect((await follows(prodId)).map((f) => f.userId)).toEqual([owner.userId]);
  });

  it("hides a product from the followed list once the caller left the workspace", async () => {
    await testApp.db.insert(schema.pushFollowedProducts).values({ userId: admin.userId, productId: prodId });
    const before = await request(testApp.http).get("/api/v1/push/followed-products").set("Cookie", admin.cookie).expect(200);
    expect(before.body).toHaveLength(1);
    await testApp.db.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.workspaceId, wsId), eq(schema.workspaceMembers.userId, admin.userId)));
    try {
      const after = await request(testApp.http).get("/api/v1/push/followed-products").set("Cookie", admin.cookie).expect(200);
      expect(after.body).toEqual([]);
    } finally {
      await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: admin.userId, role: "admin" });
    }
  });

  it("does not enqueue new-post or new-comment alerts for followers who are no longer members", async () => {
    const stale = customer; // never a member of this workspace
    const mkSub = async (userId: string, host: string) => {
      const ecdh = createECDH("prime256v1");
      await testApp.db.insert(schema.pushSubscriptions).values({
        userId, endpoint: `https://${host}.example.test/push`,
        p256dh: ecdh.generateKeys().toString("base64url"), auth: randomBytes(16).toString("base64url"),
      });
    };
    await mkSub(stale.userId, "stale");
    await mkSub(admin.userId, "current");
    await testApp.db.insert(schema.pushFollowedProducts).values([
      { userId: stale.userId, productId: prodId },
      { userId: admin.userId, productId: prodId },
    ]);
    const [st] = await testApp.db.insert(schema.statuses).values({ productId: prodId, name: "Open", color: "#123456", type: "review", position: 0, isDefault: true }).returning();
    const [post] = await testApp.db.insert(schema.posts).values({ productId: prodId, number: 1, title: "Stale Post", authorId: owner.userId, statusId: st.id }).returning();
    const [comment] = await testApp.db.insert(schema.comments).values({ postId: post.id, authorId: owner.userId, body: "c" }).returning();
    const common = {
      workspaceId: wsId, productId: prodId, postId: post.id, actorId: owner.userId, postTitle: "Stale Post",
      productName: "Follow Product", productSlug: prodSlug, workspaceSlug: wsSlug, postNumber: 1,
    };
    await testApp.db.transaction(async (tx) => {
      await pushService.enqueueNewPostPush(tx, common);
      await pushService.enqueueNewCommentPush(tx, { ...common, commentId: comment.id, actorName: "Owner" });
    });
    const rows = await testApp.db.select().from(schema.pushDeliveries);
    expect(rows.map((r) => `${r.userId}:${r.eventType}`).sort()).toEqual([
      `${admin.userId}:new_comment`, `${admin.userId}:new_post`,
    ].sort());
  });
});
