import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { startReceiver, receiverNetwork, type ReceiverReply } from "./support/webhook-receiver.js";
import { verifyWebhookSignature } from "../src/webhooks/signature.js";
import {
  WebhookWorker,
  WEBHOOK_CONCURRENCY,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETENTION_DAYS,
  backoffMinutes,
} from "../src/webhooks/webhook.worker.js";
import { enqueueWebhookEvent } from "../src/webhooks/outbox.js";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const SECRET = "whsec_workertestsecret";

describe("webhook worker against a local receiver (quick-261107-s6l)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  let worker: WebhookWorker;
  let network: ReturnType<typeof receiverNetwork>;
  let reply: (req: { path: string }) => ReceiverReply | Promise<ReceiverReply> = () => ({ status: 200 });
  let owner: { cookie: string; userId: string };
  let other: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let otherSlug: string;
  let productId: string;
  let product2Id: string;
  let statusId: string;
  let authorId: string;

  const db = () => testApp.db;
  const as = (who: { cookie: string }, r: request.Test) => r.set("Cookie", who.cookie).set("Origin", testApp.env.PUBLIC_URL);

  const seedSub = async (over: Partial<typeof schema.webhookSubscriptions.$inferInsert> = {}) => {
    const [row] = await db()
      .insert(schema.webhookSubscriptions)
      .values({ workspaceId: wsId, url: receiver.url, secret: SECRET, events: ["*"], isActive: true, ...over })
      .returning();
    return row;
  };

  const payloadFor = (event = "ping", productInfo: { id: string } | null = null, data: Record<string, any> = {}) => ({
    id: `evt_${randomBytes(16).toString("hex")}`,
    event,
    createdAt: new Date().toISOString(),
    workspace: { id: wsId, slug: wsSlug },
    product: productInfo ? { id: productInfo.id, slug: "p", name: "P" } : null,
    data,
  });

  const seedDelivery = async (
    subscriptionId: string,
    over: Partial<typeof schema.webhookDeliveries.$inferInsert> = {}
  ) => {
    const payload = (over.payload as Record<string, any> | undefined) ?? payloadFor();
    const [row] = await db()
      .insert(schema.webhookDeliveries)
      .values({
        subscriptionId,
        workspaceId: wsId,
        eventType: payload.event,
        payload,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1000),
        ...over,
      })
      .returning();
    return row;
  };

  const getDelivery = async (id: string) => {
    const [row] = await db().select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, id));
    return row;
  };

  const waitFor = async (cond: () => boolean, ms = 3000) => {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > ms) throw new Error("waitFor timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  const newAdmin = async (label: string) => {
    const who = await signedInCookie(testApp.test, {
      name: label,
      email: `${label}-${randomBytes(3).toString("hex")}@worker.test`,
      emailVerified: true,
    });
    await db().insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: who.userId, role: "admin" });
    return who;
  };

  beforeAll(async () => {
    receiver = await startReceiver((req) => reply(req));
    network = receiverNetwork({ deadlineMs: 3000 });
    testApp = await createTestApp({ outboundNetwork: network });
    worker = testApp.app.get(WebhookWorker);

    owner = await signedInCookie(testApp.test, { name: "Owner", email: "owner@worker.test", emailVerified: true });
    other = await signedInCookie(testApp.test, { name: "Other", email: "other@worker.test", emailVerified: true });
    authorId = owner.userId;

    wsSlug = `ws-wrk-${Date.now()}`;
    otherSlug = `ws-wrk-other-${Date.now()}`;
    const [ws] = await db().insert(schema.workspaces).values({ name: "Worker", slug: wsSlug }).returning();
    const [ws2] = await db().insert(schema.workspaces).values({ name: "Other", slug: otherSlug }).returning();
    wsId = ws.id;
    await db().insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: owner.userId, role: "owner" },
      { workspaceId: ws2.id, userId: other.userId, role: "owner" },
    ]);
    const [p1, p2] = await db()
      .insert(schema.products)
      .values([
        { workspaceId: wsId, name: "P1", slug: "p-one", boardEnabled: true, changelogEnabled: true },
        { workspaceId: wsId, name: "P2", slug: "p-two", boardEnabled: true, changelogEnabled: true },
      ])
      .returning();
    productId = p1.id;
    product2Id = p2.id;
    const [st] = await db()
      .insert(schema.statuses)
      .values({ productId, name: "Open", color: "#3B82F6", type: "review", isDefault: true, position: 0 })
      .returning();
    statusId = st.id;
  });

  afterEach(async () => {
    reply = () => ({ status: 200 });
    network.deadlineMs = 3000;
    receiver.requests.length = 0;
    await db().delete(schema.webhookSubscriptions);
    await db().update(schema.products).set({ boardEnabled: true, changelogEnabled: true });
  });

  afterAll(async () => {
    await testApp?.close();
    await receiver?.close();
  });

  describe("signing and retries", () => {
    it("sends the pinned headers, a verifiable signature and the stored payload as the body", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id, { payload: payloadFor("post.created", { id: productId }, { title: "T" }) });
      const res = await worker.runOnce(new Date());
      expect(res).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
      const [req] = receiver.requests;
      expect(req.headers["x-userhq-event"]).toBe("post.created");
      expect(req.headers["x-userhq-delivery"]).toBe(d.id);
      expect(req.headers["x-userhq-timestamp"]).toMatch(/^\d+$/);
      expect(req.headers["user-agent"]).toBe("UserHQ-Webhooks/1.0");
      const sig = req.headers["x-userhq-signature"] as string;
      expect(verifyWebhookSignature(req.body, sig, SECRET)).toBe(true);
      expect(verifyWebhookSignature(req.body, sig, "whsec_wrong")).toBe(false);
      expect(verifyWebhookSignature(req.body + " ", sig, SECRET)).toBe(false);
      expect(req.body).toBe(JSON.stringify((await getDelivery(d.id)).payload));
    });

    it("keeps the body and changes the signature timestamp between attempts", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id);
      let n = 0;
      reply = () => ({ status: n++ === 0 ? 503 : 200 });
      const t = new Date();
      await worker.runOnce(t);
      await new Promise((r) => setTimeout(r, 1100));
      await worker.runOnce(new Date(t.getTime() + 2 * MIN));
      expect(receiver.requests).toHaveLength(2);
      const [a, b] = receiver.requests;
      expect(a.body).toBe(b.body);
      expect(a.headers["x-userhq-timestamp"]).not.toBe(b.headers["x-userhq-timestamp"]);
      expect(a.headers["x-userhq-signature"]).not.toBe(b.headers["x-userhq-signature"]);
      expect((await getDelivery(d.id)).status).toBe("delivered");
    });

    it("backs off 1, 5, 30 and 120 minutes, fails on the fifth attempt and then stops sending", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id);
      reply = () => ({ status: 503 });
      let now = new Date();
      for (const [i, minutes] of [1, 5, 30, 120].entries()) {
        await worker.runOnce(now);
        const row = await getDelivery(d.id);
        expect(row.status).toBe("pending");
        expect(row.attempts).toBe(i + 1);
        expect(row.nextAttemptAt.getTime() - now.getTime()).toBe(minutes * MIN);
        // Too early: nothing is claimed.
        const early = await worker.runOnce(new Date(row.nextAttemptAt.getTime() - 1000));
        expect(early.claimed).toBe(0);
        now = row.nextAttemptAt;
      }
      await worker.runOnce(now);
      const last = await getDelivery(d.id);
      expect(last).toMatchObject({ status: "failed", attempts: 5, errorMessage: "HTTP 503" });
      const after = await worker.runOnce(new Date(now.getTime() + 24 * 60 * MIN));
      expect(after.claimed).toBe(0);
      expect(receiver.requests).toHaveLength(5);
    });

    it("pins the backoff schedule and its 6 hour cap", () => {
      expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([1, 5, 30, 120]);
      expect(backoffMinutes(5)).toBe(360);
      expect(backoffMinutes(99)).toBe(360);
      expect(WEBHOOK_MAX_ATTEMPTS).toBe(5);
    });

    it("costs one bounded attempt for a receiver that never answers", async () => {
      network.deadlineMs = 300;
      const sub = await seedSub();
      const d = await seedDelivery(sub.id);
      reply = () => ({ hang: true });
      const started = Date.now();
      await worker.runOnce(new Date());
      expect(Date.now() - started).toBeLessThan(300 + 1500);
      expect(await getDelivery(d.id)).toMatchObject({
        status: "pending",
        attempts: 1,
        errorMessage: "Outbound delivery timed out",
        responseBody: null,
      });
    });

    it("stores at most 1000 characters of a body larger than 1 MB", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id);
      reply = () => ({ bigBodyBytes: 1_500_000 });
      await worker.runOnce(new Date());
      const row = await getDelivery(d.id);
      expect(row.status).toBe("delivered");
      expect(row.responseBody!.length).toBeLessThanOrEqual(1000);
    });

    it("fails a delivery for a paused endpoint without contacting it", async () => {
      const sub = await seedSub({ isActive: false });
      const d = await seedDelivery(sub.id);
      const res = await worker.runOnce(new Date());
      expect(res.failed).toBe(1);
      expect(await getDelivery(d.id)).toMatchObject({ status: "failed", errorMessage: "Subscription inactive" });
      expect(receiver.requests).toHaveLength(0);
    });
  });

  describe("claims", () => {
    const seedMany = async (subId: string, n: number) => {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) ids.push((await seedDelivery(subId)).id);
      return ids;
    };

    it("runs deliveries in parallel but never more than the pool size", async () => {
      const sub = await seedSub();
      await seedMany(sub.id, 8);
      reply = () => ({ delayMs: 100 });
      const res = await worker.runOnce(new Date());
      expect(res.delivered).toBe(8);
      expect(receiver.inFlightPeak).toBeGreaterThan(1);
      expect(receiver.inFlightPeak).toBeLessThanOrEqual(WEBHOOK_CONCURRENCY);
    });

    it("delivers each delivery exactly once when two runs overlap", async () => {
      const sub = await seedSub();
      const ids = await seedMany(sub.id, 8);
      reply = () => ({ delayMs: 100 });
      const [a, b] = await Promise.all([worker.runOnce(new Date()), worker.runOnce(new Date())]);
      expect(a.delivered + b.delivered).toBe(8);
      for (const id of ids) {
        expect(receiver.requests.filter((r) => r.deliveryId === id), id).toHaveLength(1);
      }
    });

    it("never overlaps interval ticks", async () => {
      const sub = await seedSub();
      await seedDelivery(sub.id);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      reply = () => ({ gate });
      const first = worker.tick();
      await waitFor(() => receiver.requests.length === 1);
      expect(await worker.tick()).toBeNull();
      expect(receiver.requests).toHaveLength(1);
      release();
      expect(await first).toMatchObject({ delivered: 1 });
      expect(await worker.tick()).not.toBeNull();
    });

    it("lets a stale worker finish without overwriting the new owner's row", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      reply = () => ({ gate });
      const run = worker.runOnce(new Date());
      await waitFor(() => receiver.requests.length === 1);
      // Worker B reclaimed the row after the stuck timeout.
      await db()
        .update(schema.webhookDeliveries)
        .set({ attempts: 2, status: "sending", claimedAt: new Date(), errorMessage: "taken over" })
        .where(eq(schema.webhookDeliveries.id, d.id));
      const snapshot = await getDelivery(d.id);
      release();
      const res = await run;
      expect(res).toMatchObject({ delivered: 0, failed: 0 });
      expect(await getDelivery(d.id)).toEqual(snapshot);
    });

    it("reclaims a row stuck in sending after 10 minutes and counts the attempt at claim", async () => {
      const sub = await seedSub();
      const now = new Date();
      const stuck = await seedDelivery(sub.id, { status: "sending", attempts: 2, claimedAt: new Date(now.getTime() - 11 * MIN) });
      const fresh = await seedDelivery(sub.id, { status: "sending", attempts: 2, claimedAt: new Date(now.getTime() - 1 * MIN) });
      const res = await worker.runOnce(now);
      expect(res.claimed).toBe(1);
      expect(await getDelivery(stuck.id)).toMatchObject({ status: "delivered", attempts: 3 });
      expect(await getDelivery(fresh.id)).toMatchObject({ status: "sending", attempts: 2 });
    });

    it("bounds a crash loop at 5 attempts in total", async () => {
      const sub = await seedSub();
      const now = new Date();
      const old = new Date(now.getTime() - 11 * MIN);
      // Four claims already burned: the fifth is the last one that may send.
      const last = await seedDelivery(sub.id, { status: "sending", attempts: 4, claimedAt: old });
      // Five claims burned and the worker died again: the sixth must not send.
      const dead = await seedDelivery(sub.id, { status: "sending", attempts: 5, claimedAt: old });
      reply = () => ({ status: 503 });
      await worker.runOnce(now);
      expect(receiver.requests.map((r) => r.deliveryId)).toEqual([last.id]);
      expect(await getDelivery(last.id)).toMatchObject({ status: "failed", attempts: 5 });
      expect((await getDelivery(dead.id)).status).toBe("failed");
    });
  });

  describe("retention", () => {
    it("purges final rows older than 30 days and keeps pending, sending and recent ones", async () => {
      const sub = await seedSub();
      const now = new Date();
      const old = new Date(now.getTime() - (WEBHOOK_RETENTION_DAYS + 10) * DAY);
      const gone = [
        await seedDelivery(sub.id, { status: "delivered", claimedAt: old, createdAt: old }),
        await seedDelivery(sub.id, { status: "failed", claimedAt: old, createdAt: old }),
        await seedDelivery(sub.id, { status: "suppressed", claimedAt: null, createdAt: old }),
      ];
      const kept = [
        await seedDelivery(sub.id, { status: "delivered", claimedAt: new Date(now.getTime() - DAY), createdAt: old }),
        await seedDelivery(sub.id, { status: "pending", createdAt: old, nextAttemptAt: new Date(now.getTime() + DAY) }),
        await seedDelivery(sub.id, { status: "sending", createdAt: old, claimedAt: new Date(now.getTime() + DAY) }),
      ];
      expect(await worker.purgeOldDeliveries(now)).toBe(3);
      const left = await db()
        .select({ id: schema.webhookDeliveries.id })
        .from(schema.webhookDeliveries)
        .where(inArray(schema.webhookDeliveries.id, [...gone, ...kept].map((r) => r.id)));
      expect(left.map((r) => r.id).sort()).toEqual(kept.map((r) => r.id).sort());
    });
  });

  describe("disabled modules", () => {
    const enqueue = (eventType: any, productIdArg: string | null = productId) =>
      enqueueWebhookEvent(db(), { workspaceId: wsId, productId: productIdArg, eventType, data: { id: "x" } });
    const rows = () => db().select().from(schema.webhookDeliveries);

    it("does not enqueue board events while the Board is off, and keeps other products and pings unaffected", async () => {
      await seedSub();
      await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, productId));
      expect(await enqueue("post.created")).toBe(0);
      expect(await enqueue("comment.created")).toBe(0);
      expect(await enqueue("post.created", product2Id)).toBe(1);
      expect(await enqueue("changelog.published")).toBe(1);
      expect(await rows()).toHaveLength(2);
    });

    it("does not enqueue changelog events while the Changelog is off", async () => {
      await seedSub();
      await db().update(schema.products).set({ changelogEnabled: false }).where(eq(schema.products.id, productId));
      expect(await enqueue("changelog.published")).toBe(0);
      expect(await enqueue("post.created")).toBe(1);
    });

    it("suppresses queued board events at delivery for good, even after re-enabling", async () => {
      await seedSub();
      expect(await enqueue("post.created")).toBe(1);
      await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, productId));
      const res = await worker.runOnce(new Date());
      expect(res).toMatchObject({ claimed: 1, delivered: 0, suppressed: 1 });
      expect(receiver.requests).toHaveLength(0);
      const [row] = await rows();
      expect(row).toMatchObject({ status: "suppressed", errorMessage: "board_unavailable" });
      await db().update(schema.products).set({ boardEnabled: true }).where(eq(schema.products.id, productId));
      expect((await worker.runOnce(new Date(Date.now() + 10 * MIN))).claimed).toBe(0);
      expect((await rows())[0].status).toBe("suppressed");
      expect(receiver.requests).toHaveLength(0);
    });

    it("suppresses queued changelog events at delivery", async () => {
      await seedSub();
      expect(await enqueue("changelog.published")).toBe(1);
      await db().update(schema.products).set({ changelogEnabled: false }).where(eq(schema.products.id, productId));
      await worker.runOnce(new Date());
      expect((await rows())[0]).toMatchObject({ status: "suppressed", errorMessage: "changelog_unavailable" });
      expect(receiver.requests).toHaveLength(0);
    });

    it("still delivers pings and events of other products", async () => {
      const sub = await seedSub();
      await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, productId));
      await seedDelivery(sub.id, { payload: payloadFor("ping") });
      expect(await enqueue("post.created", product2Id)).toBe(1);
      const res = await worker.runOnce(new Date());
      expect(res).toMatchObject({ delivered: 2, suppressed: 0 });
    });

    it("still delivers events about a post that has since been merged", async () => {
      await seedSub();
      const [target, merged] = await db()
        .insert(schema.posts)
        .values([
          { productId, number: 1, title: "Target", statusId, authorId },
          { productId, number: 2, title: "Duplicate", statusId, authorId },
        ])
        .returning();
      expect(await enqueue("post.created")).toBe(1);
      await db().update(schema.posts).set({ mergedIntoId: target.id }).where(eq(schema.posts.id, merged.id));
      const res = await worker.runOnce(new Date());
      expect(res).toMatchObject({ delivered: 1, suppressed: 0 });
      await db().delete(schema.posts).where(inArray(schema.posts.id, [target.id, merged.id]));
    });
  });

  describe("redeliver", () => {
    const redeliver = (who: { cookie: string }, subId: string, deliveryId: string, slug = wsSlug) =>
      as(who, request(testApp.http).post(`/api/v1/workspaces/${slug}/webhooks/${subId}/deliveries/${deliveryId}/redeliver`));

    it("re-queues delivered, failed and suppressed deliveries", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-ok");
      for (const status of ["delivered", "failed", "suppressed"] as const) {
        const d = await seedDelivery(sub.id, { status, attempts: 2, errorMessage: status === "delivered" ? null : "x" });
        const res = await redeliver(admin, sub.id, d.id);
        expect(res.status, status).toBe(200);
        expect(res.body.status).toBe("pending");
        expect(res.body.errorMessage).toBeNull();
        const row = await getDelivery(d.id);
        expect(row.status).toBe("pending");
        expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() - 5000);
      }
    });

    it("makes exactly one more attempt for a delivery that used all five", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-five");
      const d = await seedDelivery(sub.id, { status: "failed", attempts: 5 });
      await redeliver(admin, sub.id, d.id).expect(200);
      reply = () => ({ status: 503 });
      await worker.runOnce(new Date(Date.now() + 1000));
      expect(receiver.requests).toHaveLength(1);
      expect(await getDelivery(d.id)).toMatchObject({ status: "failed", attempts: 5 });
    });

    it("refuses in-flight deliveries and leaves them untouched", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-inflight");
      for (const status of ["pending", "sending"] as const) {
        const d = await seedDelivery(sub.id, { status, attempts: 1, claimedAt: status === "sending" ? new Date() : null });
        const before = await getDelivery(d.id);
        const res = await redeliver(admin, sub.id, d.id);
        expect(res.status, status).toBe(409);
        expect(res.body.code).toBe("delivery_not_final");
        expect(await getDelivery(d.id)).toEqual(before);
      }
    });

    it("refuses a paused endpoint", async () => {
      const sub = await seedSub({ isActive: false });
      const admin = await newAdmin("redeliver-paused");
      const d = await seedDelivery(sub.id, { status: "failed", attempts: 5 });
      const res = await redeliver(admin, sub.id, d.id);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("webhook_inactive");
      expect((await getDelivery(d.id)).status).toBe("failed");
    });

    it("returns 404 for a deleted endpoint, an unknown delivery and a foreign workspace", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-404");
      const d = await seedDelivery(sub.id, { status: "failed", attempts: 5 });
      const foreign = await redeliver(other, sub.id, d.id, otherSlug);
      expect(foreign.status).toBe(404);
      expect((await getDelivery(d.id)).status).toBe("failed");
      const unknown = await redeliver(admin, sub.id, crypto.randomUUID());
      expect(unknown.status).toBe(404);
      await db().delete(schema.webhookSubscriptions).where(eq(schema.webhookSubscriptions.id, sub.id));
      const gone = await redeliver(admin, sub.id, d.id);
      expect(gone.status).toBe(404);
    });

    it("rejects non-members of the workspace with 404", async () => {
      const sub = await seedSub();
      const d = await seedDelivery(sub.id, { status: "failed", attempts: 5 });
      const res = await redeliver(other, sub.id, d.id);
      expect(res.status).toBe(404);
    });

    it("lets exactly one of two simultaneous calls win", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-race");
      const d = await seedDelivery(sub.id, { status: "failed", attempts: 5 });
      const results = await Promise.all([redeliver(admin, sub.id, d.id), redeliver(admin, sub.id, d.id)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it("limits one caller to 10 redeliveries a minute", async () => {
      const sub = await seedSub();
      const admin = await newAdmin("redeliver-rate");
      const ids = [];
      for (let i = 0; i < 11; i++) ids.push((await seedDelivery(sub.id, { status: "failed", attempts: 5 })).id);
      for (let i = 0; i < 10; i++) {
        expect((await redeliver(admin, sub.id, ids[i])).status, `call ${i + 1}`).toBe(200);
      }
      const eleventh = await redeliver(admin, sub.id, ids[10]);
      expect(eleventh.status).toBe(429);
      expect(eleventh.body.code).toBe("rate_limited");
    });
  });
});
