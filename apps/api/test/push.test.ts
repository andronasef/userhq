import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import { schema } from "@userhq/db";
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
      .post(`/api/v1/push/followed-products/${prodId}`)
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
      .delete(`/api/v1/push/followed-products/${prodId}`)
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
    expect(delivery.url).toBe(`/${wsSlug}/${prodSlug}/posts/${postNumber}`);
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
    expect(latest.url).toBe(`/${wsSlug}/${prodSlug}/posts/${postNumber}`);
    // userB has includePreviews: true from previous test
    expect(latest.title).toContain("User Alice");
    expect(latest.body).toContain("Here is a helpful comment reply!");
  });

  it("enqueues new post push notification to followers of a product", async () => {
    // UserB follows the product
    await request(testApp.http)
      .post(`/api/v1/push/followed-products/${prodId}`)
      .set("Cookie", userB.cookie)
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
          eq(schema.pushDeliveries.userId, userB.userId),
          eq(schema.pushDeliveries.eventType, "new_post")
        )
      );

    expect(deliveries.length).toBeGreaterThan(0);
    const latest = deliveries[deliveries.length - 1];
    expect(latest.url).toBe(`/${wsSlug}/${prodSlug}/posts/${postNumber}`);
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
