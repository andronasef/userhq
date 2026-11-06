import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createECDH, randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { PushWorker } from "../src/push/push.worker.js";
import { OutboundError, OutboundHttp } from "../src/common/outbound-http.js";

type Event = "status_change" | "comment_reply" | "new_post" | "new_comment";

describe("PushWorker send-time recheck, suppression and recovery (D-02, D-10, D-14)", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let worker: PushWorker;
  let post$: ReturnType<typeof vi.spyOn>;
  let customer: { userId: string };
  let admin: { userId: string };
  let wsId: string;
  let prodId: string;
  let postId: string;
  let otherPostId: string;
  let commentId: string;
  let sequence = 0;

  const db = () => app.db;
  const userOf = (who: "customer" | "admin") => (who === "customer" ? customer.userId : admin.userId);

  async function newSub(userId: string) {
    const ecdh = createECDH("prime256v1");
    const [row] = await db().insert(schema.pushSubscriptions).values({
      userId,
      endpoint: `https://receiver${sequence++}.example.test/push`,
      p256dh: ecdh.generateKeys().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    }).returning();
    return row;
  }

  const dataFor = (event: Event) => ({
    postId, productId: prodId,
    ...(event === "comment_reply" || event === "new_comment" ? { commentId } : {}),
  });

  async function enqueue(event: Event | "test", who: "customer" | "admin" = event === "new_post" || event === "new_comment" ? "admin" : "customer") {
    const sub = await newSub(userOf(who));
    const [row] = await db().insert(schema.pushDeliveries).values({
      subscriptionId: sub.id, userId: userOf(who), eventType: event, title: "t", body: "b", url: "/x",
      data: event === "test" ? { test: true } : dataFor(event),
    }).returning();
    return { id: row.id, sub };
  }
  async function row(id: string) {
    const [r] = await db().select().from(schema.pushDeliveries).where(eq(schema.pushDeliveries.id, id));
    return r;
  }

  beforeAll(async () => {
    app = await createTestApp();
    worker = app.app.get(PushWorker);
    const owner = await signedInCookie(app.test, { name: "W Owner", email: "w-owner@push.test", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "W Customer", email: "w-customer@push.test", emailVerified: true });
    admin = await signedInCookie(app.test, { name: "W Admin", email: "w-admin@push.test", emailVerified: true });
    const [ws] = await db().insert(schema.workspaces).values({ name: "Worker WS", slug: "worker-ws" }).returning();
    wsId = ws.id;
    await db().insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: owner.userId, role: "owner" });
    const [prod] = await db().insert(schema.products).values({ workspaceId: wsId, name: "Worker Product", slug: "worker-prod" }).returning();
    prodId = prod.id;
    const [st] = await db().insert(schema.statuses).values({ productId: prodId, name: "Open", color: "#123456", type: "review", position: 0, isDefault: true }).returning();
    const [p1] = await db().insert(schema.posts).values({ productId: prodId, number: 1, title: "Worker Post", authorId: customer.userId, statusId: st.id }).returning();
    const [p2] = await db().insert(schema.posts).values({ productId: prodId, number: 2, title: "Other Post", authorId: customer.userId, statusId: st.id }).returning();
    postId = p1.id;
    otherPostId = p2.id;
    const [c] = await db().insert(schema.comments).values({ postId, authorId: customer.userId, body: "hello" }).returning();
    commentId = c.id;
  });
  afterAll(async () => { await app?.close(); });

  beforeEach(async () => {
    const d = db();
    await d.delete(schema.pushDeliveries);
    await d.delete(schema.pushSubscriptions);
    await d.delete(schema.pushPreferences);
    await d.delete(schema.postMutes);
    await d.update(schema.user).set({ bannedAt: null, deletedAt: null }).where(inArray(schema.user.id, [customer.userId, admin.userId]));
    await d.update(schema.products).set({ boardEnabled: true, deletedAt: null }).where(eq(schema.products.id, prodId));
    await d.update(schema.workspaces).set({ deletedAt: null, suspendedAt: null }).where(eq(schema.workspaces.id, wsId));
    await d.update(schema.posts).set({ deletedAt: null, mergedIntoId: null }).where(inArray(schema.posts.id, [postId, otherPostId]));
    await d.update(schema.comments).set({ deletedAt: null }).where(eq(schema.comments.id, commentId));
    await d.insert(schema.pushFollowedProducts).values({ userId: admin.userId, productId: prodId }).onConflictDoNothing();
    await d.insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: admin.userId, role: "admin" }).onConflictDoNothing();
    post$ = vi.spyOn(app.app.get(OutboundHttp), "post").mockResolvedValue({ statusCode: 201, body: "" } as any);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  describe("delivery outcomes", () => {
    it("delivers a fully valid status change", async () => {
      const { id, sub } = await enqueue("status_change");
      await worker.processPending();
      expect(await row(id)).toMatchObject({ status: "delivered", attempts: 1, errorMessage: null });
      expect((await row(id)).deliveredAt).toBeInstanceOf(Date);
      expect(post$).toHaveBeenCalledTimes(1);
      expect(post$.mock.calls[0][0]).toBe(sub.endpoint);
    });

    it("delivers a new post to a current admin follower", async () => {
      const { id } = await enqueue("new_post");
      await worker.processPending();
      expect((await row(id)).status).toBe("delivered");
    });

    it("delivers a test event with no product data", async () => {
      await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, prodId));
      const { id } = await enqueue("test");
      await worker.processPending();
      expect((await row(id)).status).toBe("delivered");
    });

    it.each([404, 410, 401, 403])("removes the subscription on HTTP %i (its queued rows cascade away)", async (code) => {
      post$.mockRejectedValue(Object.assign(new Error(`HTTP ${code}`), { statusCode: code }));
      const { id, sub } = await enqueue("status_change");
      await worker.processPending();
      expect(await db().select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id))).toHaveLength(0);
      // push_deliveries.subscription_id is ON DELETE CASCADE: nothing is left to retry.
      expect(await row(id)).toBeUndefined();
      expect(post$).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["HTTP 500", () => Object.assign(new Error("HTTP 500"), { statusCode: 500 })],
      ["OutboundError", () => new OutboundError("Outbound delivery timed out")],
    ])("retries a transient %s with backoff, then fails on the third attempt", async (_n, makeErr) => {
      post$.mockRejectedValue(makeErr());
      const { id } = await enqueue("status_change");
      const near = (r: { nextAttemptAt: Date }, ms: number) => {
        const delta = r.nextAttemptAt.getTime() - Date.now();
        expect(delta).toBeGreaterThan(ms - 3000);
        expect(delta).toBeLessThan(ms + 3000);
      };
      await worker.processPending();
      let r = await row(id);
      expect(r).toMatchObject({ status: "pending", attempts: 1 });
      near(r, 5_000);
      await db().update(schema.pushDeliveries).set({ nextAttemptAt: new Date(0) }).where(eq(schema.pushDeliveries.id, id));
      await worker.processPending();
      r = await row(id);
      expect(r).toMatchObject({ status: "pending", attempts: 2 });
      near(r, 30_000);
      await db().update(schema.pushDeliveries).set({ nextAttemptAt: new Date(0) }).where(eq(schema.pushDeliveries.id, id));
      await worker.processPending();
      expect(await row(id)).toMatchObject({ status: "failed", attempts: 3 });
    });
  });

  describe("send-time suppression", () => {
    const prefOff = (who: "customer" | "admin", patch: Partial<typeof schema.pushPreferences.$inferInsert>) => async () => {
      await db().insert(schema.pushPreferences).values({ userId: userOf(who), ...patch });
    };
    const cases: Array<[string, string, Event, "customer" | "admin", () => Promise<void>]> = [
      ["master switch off", "preferences_disabled", "status_change", "customer", prefOff("customer", { enabled: false })],
      ["status_change flag off", "event_disabled", "status_change", "customer", prefOff("customer", { notifyStatusChanges: false })],
      ["comment_reply flag off", "event_disabled", "comment_reply", "customer", prefOff("customer", { notifyReplies: false })],
      ["new_post flag off", "event_disabled", "new_post", "admin", prefOff("admin", { notifyNewPosts: false })],
      ["new_comment flag off", "event_disabled", "new_comment", "admin", prefOff("admin", { notifyNewComments: false })],
      ["recipient banned", "recipient_inactive", "status_change", "customer", async () => {
        await db().update(schema.user).set({ bannedAt: new Date() }).where(eq(schema.user.id, customer.userId));
      }],
      ["recipient deleted", "recipient_inactive", "status_change", "customer", async () => {
        await db().update(schema.user).set({ deletedAt: new Date() }).where(eq(schema.user.id, customer.userId));
      }],
      ["board off", "board_unavailable", "status_change", "customer", async () => {
        await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, prodId));
      }],
      ["product deleted", "board_unavailable", "status_change", "customer", async () => {
        await db().update(schema.products).set({ deletedAt: new Date() }).where(eq(schema.products.id, prodId));
      }],
      ["workspace deleted", "board_unavailable", "status_change", "customer", async () => {
        await db().update(schema.workspaces).set({ deletedAt: new Date() }).where(eq(schema.workspaces.id, wsId));
      }],
      ["workspace suspended", "board_unavailable", "status_change", "customer", async () => {
        await db().update(schema.workspaces).set({ suspendedAt: new Date() }).where(eq(schema.workspaces.id, wsId));
      }],
      ["post deleted", "post_unavailable", "status_change", "customer", async () => {
        await db().update(schema.posts).set({ deletedAt: new Date() }).where(eq(schema.posts.id, postId));
      }],
      ["post merged", "post_unavailable", "status_change", "customer", async () => {
        await db().update(schema.posts).set({ mergedIntoId: otherPostId }).where(eq(schema.posts.id, postId));
      }],
      ["reply comment deleted", "comment_deleted", "comment_reply", "customer", async () => {
        await db().update(schema.comments).set({ deletedAt: new Date() }).where(eq(schema.comments.id, commentId));
      }],
      ["new_comment comment deleted", "comment_deleted", "new_comment", "admin", async () => {
        await db().update(schema.comments).set({ deletedAt: new Date() }).where(eq(schema.comments.id, commentId));
      }],
      ["post muted", "post_muted", "status_change", "customer", async () => {
        await db().insert(schema.postMutes).values({ userId: customer.userId, postId });
      }],
      ["new_post unfollowed", "not_following", "new_post", "admin", async () => {
        await db().delete(schema.pushFollowedProducts).where(eq(schema.pushFollowedProducts.userId, admin.userId));
      }],
      ["new_comment unfollowed", "not_following", "new_comment", "admin", async () => {
        await db().delete(schema.pushFollowedProducts).where(eq(schema.pushFollowedProducts.userId, admin.userId));
      }],
      ["new_post admin removed", "not_workspace_admin", "new_post", "admin", async () => {
        await db().delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.userId, admin.userId), eq(schema.workspaceMembers.workspaceId, wsId)));
      }],
      ["new_comment admin removed", "not_workspace_admin", "new_comment", "admin", async () => {
        await db().delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.userId, admin.userId), eq(schema.workspaceMembers.workspaceId, wsId)));
      }],
    ];

    it.each(cases)("%s -> %s", async (_name, reason, event, who, mutate) => {
      await mutate();
      const { id } = await enqueue(event, who);
      await worker.processPending();
      const r = await row(id);
      expect(r.status).toBe("suppressed");
      expect(r.errorMessage).toBe(reason);
      expect(r.attempts).toBe(0);
      expect(r.deliveredAt).toBeNull();
      expect(post$).not.toHaveBeenCalled();
    });

    it("never replays a suppressed row after the condition is restored (D-14)", async () => {
      await db().update(schema.products).set({ boardEnabled: false }).where(eq(schema.products.id, prodId));
      await db().insert(schema.pushPreferences).values({ userId: customer.userId, enabled: false });
      const { id } = await enqueue("status_change");
      await worker.processPending();
      expect((await row(id)).status).toBe("suppressed");
      await db().update(schema.products).set({ boardEnabled: true }).where(eq(schema.products.id, prodId));
      await db().update(schema.pushPreferences).set({ enabled: true }).where(eq(schema.pushPreferences.userId, customer.userId));
      await worker.processPending();
      expect(await row(id)).toMatchObject({ status: "suppressed", errorMessage: "preferences_disabled" });
      expect(post$).not.toHaveBeenCalled();
    });
  });

  describe("stuck-row reclaim", () => {
    it("reclaims a row stuck in sending for 11 minutes and leaves a 1 minute old claim alone", async () => {
      const stale = await enqueue("status_change");
      const fresh = await enqueue("status_change");
      await db().update(schema.pushDeliveries).set({ status: "sending", claimedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.pushDeliveries.id, stale.id));
      await db().update(schema.pushDeliveries).set({ status: "sending", claimedAt: new Date(Date.now() - 60_000) }).where(eq(schema.pushDeliveries.id, fresh.id));
      await worker.processPending();
      expect((await row(stale.id)).status).toBe("delivered");
      expect((await row(fresh.id)).status).toBe("sending");
      expect(post$).toHaveBeenCalledTimes(1);
    });
  });
});
