import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "../src/webhooks/signature.js";
import { WebhookWorker } from "../src/webhooks/webhook.worker.js";
import { fixtureOutboundNetwork } from "./support/outbound-network.js";

describe("Signed Outbound Webhooks (Phase 10)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let otherAdmin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let otherWsSlug: string;
  let otherWsId: string;
  let prodASlug: string;
  let prodAId: string;
  let prodBSlug: string;
  let prodBId: string;
  let categoryId: string;
  let statusId: string;
  let webhookWorker: WebhookWorker;
  let dnsAddress = "8.8.8.8";

  beforeAll(async () => {
    testApp = await createTestApp({ outboundNetwork: {
      ...fixtureOutboundNetwork,
      resolve: async hostname => hostname === "changing.example.test"
        ? [{ address: dnsAddress, family: 4 }]
        : hostname === "mixed.example.test"
          ? [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]
          : fixtureOutboundNetwork.resolve(hostname),
      request: (url, options, response) => {
        if (url.hostname !== "receiver.example.test") throw new Error("No fixture receiver");
        return http.request(new URL(`http://127.0.0.1:${url.port}${url.pathname}`), options, response);
      },
    } });
    webhookWorker = testApp.app.get(WebhookWorker);

    admin = await signedInCookie(testApp.test, {
      name: "Admin Alice",
      email: "alice@webhooks.test",
      emailVerified: true,
    });

    otherAdmin = await signedInCookie(testApp.test, {
      name: "Other Eve",
      email: "eve@webhooks.test",
      emailVerified: true,
    });

    // Create workspace 1
    wsSlug = `ws-wh-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Webhooks Workspace",
        slug: wsSlug,
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: admin.userId,
      role: "owner",
    });

    // Create products
    prodASlug = `prod-a-${Date.now()}`;
    const [prodA] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product A",
        slug: prodASlug,
        boardEnabled: true,
      })
      .returning();
    prodAId = prodA.id;

    prodBSlug = `prod-b-${Date.now()}`;
    const [prodB] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product B",
        slug: prodBSlug,
        boardEnabled: true,
      })
      .returning();
    prodBId = prodB.id;

    const [cat] = await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodAId,
        name: "Features",
      })
      .returning();
    categoryId = cat.id;

    const [st] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodAId,
        name: "Open",
        color: "#3B82F6",
        type: "review",
        isDefault: true,
        position: 0,
      })
      .returning();
    statusId = st.id;

    // Create other workspace
    otherWsSlug = `other-wh-${Date.now()}`;
    const [otherWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Other Workspace",
        slug: otherWsSlug,
      })
      .returning();
    otherWsId = otherWs.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: otherWsId,
      userId: otherAdmin.userId,
      role: "owner",
    });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("rejects unsafe webhook targets before persistence", async () => {
    for (const url of [
      "http://127.0.0.1/internal", "https://user:pass@example.com/hook",
      "https://127.1/hook", "https://2130706433/hook", "https://0x7f000001/hook",
      "https://10.1.2.3/hook", "https://169.254.169.254/hook", "https://100.64.0.1/hook",
      "https://192.168.1.1/hook", "https://172.20.1.1/hook", "https://198.18.0.1/hook",
      "https://192.0.2.1/hook", "https://224.0.0.1/hook", "https://240.0.0.1/hook",
      "https://[::1]/hook", "https://[::ffff:127.0.0.1]/hook", "https://[fc00::1]/hook",
      "https://[fe80::1]/hook", "https://[64:ff9b::7f00:1]/hook", "https://[2001:db8::1]/hook",
      "https://[2002:7f00:1::]/hook", "https://[3fff::1]/hook", "https://missing.example.test/hook",
      "https://mixed.example.test/hook",
    ]) {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
        .send({ url, events: ["*"] });
      expect(res.status, url).toBe(400);
      expect(res.body.code).toBe("invalid_url");
    }
  });

  it("revalidates changed webhook URLs and rejects non-public DNS answers", async () => {
    const created = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ url: "https://changing.example.test/hook", events: ["*"] });
    expect(created.status).toBe(201);
    dnsAddress = "127.0.0.1";
    const updated = await request(testApp.http).patch(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ url: "https://changing.example.test/changed" });
    expect(updated.status).toBe(400);
    expect(updated.body.code).toBe("invalid_url");
    dnsAddress = "8.8.8.8";
    const removed = await request(testApp.http).delete(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL);
    expect(removed.status).toBe(204);
  });

  it("blocks a destination whose DNS becomes private before delivery", async () => {
    const created = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ url: "https://changing.example.test/hook", events: ["*"] });
    expect(created.status).toBe(201);
    await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}/ping`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL).expect(201);
    dnsAddress = "10.0.0.1";
    await webhookWorker.runOnce();
    const deliveries = await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}/deliveries`)
      .set("Cookie", admin.cookie);
    expect(deliveries.body.deliveries[0].errorMessage).toBe("Outbound destination rejected");
    expect(deliveries.body.deliveries[0].responseBody).toBeNull();
    dnsAddress = "8.8.8.8";
    await request(testApp.http).delete(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL).expect(204);
  });

  describe("HMAC Signing & Verification", () => {
    it("signs and verifies payload correctly", () => {
      const payload = JSON.stringify({ hello: "world" });
      const secret = "whsec_testsecret123456789";
      const { header } = signWebhookPayload(payload, secret);

      const isValid = verifyWebhookSignature(payload, header, secret);
      expect(isValid).toBe(true);
    });

    it("rejects tampered payload or incorrect secret", () => {
      const payload = JSON.stringify({ hello: "world" });
      const secret = "whsec_testsecret123456789";
      const { header } = signWebhookPayload(payload, secret);

      expect(
        verifyWebhookSignature(
          JSON.stringify({ hello: "hacked" }),
          header,
          secret
        )
      ).toBe(false);
      expect(
        verifyWebhookSignature(payload, header, "whsec_wrongsecret")
      ).toBe(false);
    });

    it("rejects expired timestamps exceeding tolerance", () => {
      const payload = JSON.stringify({ hello: "world" });
      const secret = "whsec_testsecret123456789";
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago
      const { header } = signWebhookPayload(payload, secret, expiredTimestamp);

      // Default tolerance is 300s
      const isValid = verifyWebhookSignature(payload, header, secret, 300);
      expect(isValid).toBe(false);
    });
  });

  describe("Webhook Subscriptions API", () => {
    let createdSubId: string;

    it("creates a webhook subscription with whsec_ secret", async () => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          url: "https://example.com/webhook-receiver",
          events: ["post.created", "post.status_changed"],
          description: "Primary webhook receiver",
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.url).toBe("https://example.com/webhook-receiver");
      expect(res.body.secret).toMatch(/^whsec_[A-Za-z0-9_-]+$/);
      expect(res.body.events).toEqual(["post.created", "post.status_changed"]);
      expect(res.body.isActive).toBe(true);

      createdSubId = res.body.id;
    });

    it("lists subscriptions for workspace", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toHaveLength(1);
      expect(res.body.subscriptions[0].id).toBe(createdSubId);
    });

    it("prevents cross-tenant access to subscriptions", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${otherWsSlug}/webhooks/${createdSubId}`)
        .set("Cookie", otherAdmin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
    });

    it("updates a subscription", async () => {
      const res = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/webhooks/${createdSubId}`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          events: ["*"],
          description: "Catch-all webhook",
        });

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual(["*"]);
      expect(res.body.description).toBe("Catch-all webhook");
    });

    it("enqueues a test ping event", async () => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks/${createdSubId}/ping`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(201);
      expect(res.body.enqueued).toBe(true);
      expect(res.body.deliveryId).toBeDefined();
    });

    it("lists deliveries for a subscription", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks/${createdSubId}/deliveries`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.deliveries.length).toBeGreaterThanOrEqual(1);
      expect(res.body.deliveries[0].eventType).toBe("ping");
      expect(res.body.deliveries[0].status).toBe("pending");
    });
  });

  describe("Event Enqueueing & Delivery Worker", () => {
    let mockReceiverServer: http.Server;
    let mockReceiverUrl: string;
    let retryFailures = 1;
    const receivedRequests: Array<{
      headers: http.IncomingHttpHeaders;
      body: string;
    }> = [];

    beforeAll(async () => {
      await new Promise<void>((resolve) => {
        mockReceiverServer = http.createServer((req, res) => {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            receivedRequests.push({ headers: req.headers, body });
            const status = req.url === "/retry" && retryFailures-- > 0 ? 503 : 200;
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          });
        });

        mockReceiverServer.listen(0, "127.0.0.1", () => {
          const addr = mockReceiverServer.address() as AddressInfo;
          mockReceiverUrl = `https://receiver.example.test:${addr.port}/hook`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        mockReceiverServer.close(() => resolve());
      });
    });

    it("retains signed delivery identity across a failed attempt and successful retry", async () => {
      const created = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
        .send({ url: mockReceiverUrl.replace("/hook", "/retry"), events: ["*"] });
      expect(created.status).toBe(201);
      const ping = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}/ping`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL).expect(201);
      const now = new Date();
      await webhookWorker.runOnce(now);
      const list = () => request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}/deliveries`).set("Cookie", admin.cookie);
      const failed = await list();
      expect(failed.body.deliveries[0]).toMatchObject({ status: "pending", attempts: 1, responseStatusCode: 503 });
      await webhookWorker.runOnce(new Date(now.getTime() + 2 * 60_000));
      const retried = await list();
      expect(retried.body.deliveries[0]).toMatchObject({ status: "delivered", attempts: 2, responseStatusCode: 200 });
      const attempts = receivedRequests.filter(item => item.headers["x-userhq-delivery"] === ping.body.deliveryId);
      expect(attempts).toHaveLength(2);
      expect(attempts[0].body).toBe(attempts[1].body);
      for (const attempt of attempts) {
        expect(verifyWebhookSignature(attempt.body, attempt.headers["x-userhq-signature"] as string, created.body.secret)).toBe(true);
      }
      await request(testApp.http).delete(`/api/v1/workspaces/${wsSlug}/webhooks/${created.body.id}`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL).expect(204);
    });

    it("enqueues post.created event and worker signs and delivers payload successfully", async () => {
      // 1. Create a subscription pointing to our mock receiver
      const subRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          url: mockReceiverUrl,
          events: ["post.created"],
          productRestrictions: [prodAId],
          description: "Local live receiver",
        });

      expect(subRes.status).toBe(201);
      const subId = subRes.body.id;
      const subSecret = subRes.body.secret;

      // 2. Create a post in product A
      const postRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Webhook triggered post",
          description: "Testing end-to-end webhook dispatch",
          categoryId,
        });

      expect(postRes.status).toBe(201);

      // 3. Run worker cycle
      const result = await webhookWorker.runOnce(new Date());
      expect(result.claimed).toBeGreaterThanOrEqual(1);
      expect(result.delivered).toBeGreaterThanOrEqual(1);

      // 4. Verify mock receiver got the request
      expect(receivedRequests.length).toBeGreaterThanOrEqual(1);
      const lastRequest = receivedRequests[receivedRequests.length - 1];

      expect(lastRequest.headers["x-userhq-event"]).toBe("post.created");
      expect(lastRequest.headers["content-type"]).toBe("application/json");

      const signatureHeader = lastRequest.headers["x-userhq-signature"] as string;
      expect(signatureHeader).toBeDefined();

      const isValid = verifyWebhookSignature(
        lastRequest.body,
        signatureHeader,
        subSecret
      );
      expect(isValid).toBe(true);

      const parsedPayload = JSON.parse(lastRequest.body);
      expect(parsedPayload.event).toBe("post.created");
      expect(parsedPayload.workspace.slug).toBe(wsSlug);
      expect(parsedPayload.product.id).toBe(prodAId);
      expect(parsedPayload.data.title).toBe("Webhook triggered post");

      // 5. Verify deliveries endpoint reports delivered status
      const deliveriesRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/deliveries`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(deliveriesRes.status).toBe(200);
      const postDelivery = deliveriesRes.body.deliveries.find(
        (d: any) => d.eventType === "post.created"
      );
      expect(postDelivery).toBeDefined();
      expect(postDelivery.status).toBe("delivered");
      expect(postDelivery.responseStatusCode).toBe(200);
    });

    it("respects product restrictions and skips non-matching products", async () => {
      // Create subscription restricted to prodB
      const subRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          url: mockReceiverUrl,
          events: ["post.created"],
          productRestrictions: [prodBId],
        });

      const subId = subRes.body.id;

      // Create post in prodA
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Another post for prodA",
          categoryId,
        });

      // Check deliveries for prodB sub - should be empty!
      const deliveriesRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/deliveries`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(deliveriesRes.status).toBe(200);
      expect(deliveriesRes.body.deliveries).toHaveLength(0);
    });

    it("redelivers a delivery", async () => {
      // 1. Create a subscription
      const subRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          url: mockReceiverUrl,
          events: ["*"],
        });

      const subId = subRes.body.id;

      // 2. Ping it to create a delivery
      const pingRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/ping`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      const deliveryId = pingRes.body.deliveryId;

      // 3. Worker delivers it
      await webhookWorker.runOnce(new Date());

      // 4. Verify it was delivered
      const checkRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/deliveries`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      const delivery = checkRes.body.deliveries.find((d: any) => d.id === deliveryId);
      expect(delivery.status).toBe("delivered");

      // 5. Trigger redeliver endpoint
      const redeliverRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/deliveries/${deliveryId}/redeliver`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(redeliverRes.status).toBe(200);
      expect(redeliverRes.body.status).toBe("pending");
    });

    it("deletes a webhook subscription", async () => {
      const subRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          url: "https://example.com/delete-me",
          events: ["post.created"],
        });

      const subId = subRes.body.id;

      const deleteRes = await request(testApp.http)
        .delete(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(getRes.status).toBe(404);
    });
  });

  describe("unambiguous productRestrictions (quick-261108-unx, D-05, D-11)", () => {
    const UNKNOWN = "00000000-0000-4000-8000-000000000000";
    let foreignProdId: string;
    let deletedProdId: string;
    let categoryBId: string;
    const made: string[] = [];
    const hooksUrl = () => `/api/v1/workspaces/${wsSlug}/webhooks`;
    const admin$ = (r: request.Test) => r.set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL);
    const create = (body: Record<string, unknown>) =>
      admin$(request(testApp.http).post(hooksUrl())).send({
        url: "https://example.com/restriction-receiver",
        events: ["post.created"],
        ...body,
      });
    const createOk = async (body: Record<string, unknown> = {}) => {
      const res = await create(body);
      expect(res.status).toBe(201);
      made.push(res.body.id);
      return res.body.id as string;
    };
    const patch = (id: string, body: Record<string, unknown>) =>
      admin$(request(testApp.http).patch(`${hooksUrl()}/${id}`)).send(body);
    const stored = async (id: string) =>
      (await testApp.db.select().from(schema.webhookSubscriptions).where(eq(schema.webhookSubscriptions.id, id)))[0];
    const deliveryCount = async (id: string) =>
      (await testApp.db.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.subscriptionId, id))).length;
    const subCount = async () =>
      (await testApp.db.select().from(schema.webhookSubscriptions).where(eq(schema.webhookSubscriptions.workspaceId, wsId))).length;
    const postIn = async (slug: string, categoryId_: string, title: string) => {
      const res = await admin$(request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/products/${slug}/posts`)).send({
        title,
        categoryId: categoryId_,
      });
      expect(res.status).toBe(201);
    };

    beforeAll(async () => {
      const [foreign] = await testApp.db
        .insert(schema.products)
        .values({ workspaceId: otherWsId, name: "Foreign", slug: `foreign-${Date.now()}` })
        .returning();
      foreignProdId = foreign.id;
      const [deleted] = await testApp.db
        .insert(schema.products)
        .values({ workspaceId: wsId, name: "Gone", slug: `gone-${Date.now()}`, deletedAt: new Date() })
        .returning();
      deletedProdId = deleted.id;
      const [catB] = await testApp.db
        .insert(schema.categories)
        .values({ productId: prodBId, name: "Ideas" })
        .returning();
      categoryBId = catB.id;
      await testApp.db.insert(schema.statuses).values({
        productId: prodBId,
        name: "Open",
        color: "#3B82F6",
        type: "review",
        isDefault: true,
        position: 0,
      });
    });

    afterAll(async () => {
      for (const id of made) {
        await testApp.db.delete(schema.webhookSubscriptions).where(eq(schema.webhookSubscriptions.id, id));
      }
    });

    const rejected: Array<[string, () => unknown]> = [
      ["an empty list", () => []],
      ["a product of another workspace", () => [foreignProdId]],
      ["a valid and a foreign product", () => [prodAId, foreignProdId]],
      ["a soft-deleted product", () => [deletedProdId]],
      ["an unknown uuid", () => [UNKNOWN]],
    ];

    it.each(rejected)("POST with %s returns 400 validation_failed and stores nothing", async (_l, ids) => {
      const before = await subCount();
      const res = await create({ productRestrictions: ids() });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("validation_failed");
      expect(await subCount()).toBe(before);
    });

    it("gives foreign, deleted and unknown ids the same message", async () => {
      const messages = new Set<string>();
      for (const id of [foreignProdId, deletedProdId, UNKNOWN]) {
        const res = await create({ productRestrictions: [id] });
        expect(res.status).toBe(400);
        messages.add(res.body.message);
      }
      expect(messages.size).toBe(1);
    });

    it("treats omitted and null as unrestricted and stores duplicate ids once", async () => {
      expect((await stored(await createOk())).productRestrictions).toBeNull();
      expect((await stored(await createOk({ productRestrictions: null }))).productRestrictions).toBeNull();
      expect((await stored(await createOk({ productRestrictions: [prodAId, prodAId] }))).productRestrictions).toEqual([prodAId]);
    });

    it("PATCH rejects [] and foreign ids, accepts null and a valid list", async () => {
      const id = await createOk({ productRestrictions: [prodAId] });

      for (const ids of [[], [foreignProdId], [deletedProdId]]) {
        const res = await patch(id, { productRestrictions: ids });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("validation_failed");
        expect((await stored(id)).productRestrictions).toEqual([prodAId]);
      }

      const toB = await patch(id, { productRestrictions: [prodBId] });
      expect(toB.status).toBe(200);
      expect(toB.body.productRestrictions).toEqual([prodBId]);

      const cleared = await patch(id, { productRestrictions: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.productRestrictions).toBeNull();

      await postIn(prodASlug, categoryId, "Cleared restriction, product A");
      await postIn(prodBSlug, categoryBId, "Cleared restriction, product B");
      expect(await deliveryCount(id)).toBe(2);
    });

    it("denies a subscription whose stored value is [] or malformed, on the same rule as keys", async () => {
      const open = await createOk();
      const forcedEmpty = await createOk();
      const forcedBad = await createOk();
      await testApp.db
        .update(schema.webhookSubscriptions)
        .set({ productRestrictions: [] })
        .where(eq(schema.webhookSubscriptions.id, forcedEmpty));
      await testApp.db
        .update(schema.webhookSubscriptions)
        .set({ productRestrictions: "oops" as any })
        .where(eq(schema.webhookSubscriptions.id, forcedBad));

      await postIn(prodASlug, categoryId, "Forced empty restriction");

      expect(await deliveryCount(open)).toBe(1);
      expect(await deliveryCount(forcedEmpty)).toBe(0);
      expect(await deliveryCount(forcedBad)).toBe(0);
    });
  });
});
