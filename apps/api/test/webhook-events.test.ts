import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { startReceiver, receiverNetwork } from "./support/webhook-receiver.js";
import { WebhookWorker } from "../src/webhooks/webhook.worker.js";

const MIN = 60_000;
const EVENT_ID = /^evt_[0-9a-f]{32}$/;
const SECRET_TITLE = "SECRET-INTERNAL-TITLE-9f3";
const SECRET_DESC = "SECRET-INTERNAL-DESC-9f3";
const SECRET_NOTES = "SECRET-INTERNAL-NOTES-9f3";
const ASSIGNEE_NAME = "Quentin Assignee";

describe("missing D-06 webhook events with stable ids (quick-261107-s6l)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  let worker: WebhookWorker;
  let owner: { cookie: string; userId: string };
  let customer: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;
  let subId: string;
  let commentSubId: string;
  let open: { id: string };
  let planned: { id: string; name: string; color: string };
  let active: { id: string; name: string; color: string };
  let nextNumber = 1;
  let failNext = 0;

  const db = () => testApp.db;
  const prodBase = () => `/api/v1/workspaces/${wsSlug}/products/${prodSlug}`;
  const asOwner = (r: request.Test) => r.set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL);

  const deliveries = async (eventType?: string) => {
    const rows = await db().select().from(schema.webhookDeliveries).orderBy(schema.webhookDeliveries.createdAt);
    return rows.filter((r) => !eventType || r.eventType === eventType);
  };
  /** Payloads for one event type as seen by the `*` subscription (one row per subscription otherwise). */
  const events = async (eventType: string) =>
    (await deliveries(eventType)).filter((r) => r.subscriptionId === subId).map((r) => r.payload as any);

  const mkPost = async (statusId: string, extra: Partial<typeof schema.posts.$inferInsert> = {}) => {
    const number = nextNumber++;
    const [row] = await db()
      .insert(schema.posts)
      .values({ productId: prodId, number, title: `Event post ${number}`, statusId, authorId: customer.userId, ...extra })
      .returning();
    return row;
  };

  const mkItem = (statusId: string, extra: Record<string, unknown> = {}) =>
    asOwner(request(testApp.http).post(`${prodBase()}/roadmap`)).send({
      statusId,
      internalTitle: SECRET_TITLE,
      internalDescription: SECRET_DESC,
      internalNotes: SECRET_NOTES,
      assigneeId: owner.userId,
      ...extra,
    });

  beforeAll(async () => {
    receiver = await startReceiver(() => ({ status: failNext-- > 0 ? 503 : 200 }));
    testApp = await createTestApp({ outboundNetwork: receiverNetwork({ deadlineMs: 2000 }) });
    worker = testApp.app.get(WebhookWorker);

    owner = await signedInCookie(testApp.test, { name: ASSIGNEE_NAME, email: "owner@events.test", emailVerified: true });
    customer = await signedInCookie(testApp.test, { name: "Customer Carl", email: "carl@events.test", emailVerified: true });

    wsSlug = `ws-evt-${Date.now()}`;
    prodSlug = "evt-prod";
    const [ws] = await db().insert(schema.workspaces).values({ name: "Events", slug: wsSlug }).returning();
    wsId = ws.id;
    await db().insert(schema.workspaceMembers).values({ workspaceId: wsId, userId: owner.userId, role: "owner" });
    const [prod] = await db()
      .insert(schema.products)
      .values({ workspaceId: wsId, name: "Events Product", slug: prodSlug })
      .returning();
    prodId = prod.id;
    const [s1, s2, s3] = await db()
      .insert(schema.statuses)
      .values([
        { productId: prodId, name: "Under Review", color: "#3B82F6", type: "review", isDefault: true, position: 0 },
        { productId: prodId, name: "Planned", color: "#8B5CF6", type: "planned", position: 1 },
        { productId: prodId, name: "In Progress", color: "#F59E0B", type: "active", position: 2 },
      ])
      .returning();
    open = s1;
    planned = s2;
    active = s3;

    const [all, commentsOnly] = await db()
      .insert(schema.webhookSubscriptions)
      .values([
        { workspaceId: wsId, url: receiver.url, secret: "whsec_events", events: ["*"], isActive: true },
        { workspaceId: wsId, url: receiver.url, secret: "whsec_events2", events: ["comment.created"], isActive: true },
      ])
      .returning();
    subId = all.id;
    commentSubId = commentsOnly.id;
  });

  beforeEach(async () => {
    await db().delete(schema.webhookDeliveries);
    receiver.requests.length = 0;
  });

  afterAll(async () => {
    await testApp?.close();
    await receiver?.close();
  });

  describe("roadmap-driven post.status_changed", () => {
    it("emits one event per linked post whose status changed, with no roadmap internals", async () => {
      const p1 = await mkPost(open.id);
      const p2 = await mkPost(open.id);
      // Created with postIds: both posts move Open -> Planned.
      const created = await mkItem(planned.id, { postIds: [p1.id, p2.id] });
      expect(created.status).toBe(201);
      const itemId = created.body.id as string;

      const onCreate = await events("post.status_changed");
      expect(onCreate).toHaveLength(2);
      expect(new Set(onCreate.map((e) => e.id)).size).toBe(2);
      for (const e of onCreate) expect(e.id).toMatch(EVENT_ID);
      const byPost = Object.fromEntries(onCreate.map((e) => [e.data.postId, e]));
      expect(byPost[p1.id].data).toEqual({
        postId: p1.id,
        postNumber: p1.number,
        previousStatusId: open.id,
        newStatus: { id: planned.id, name: planned.name, color: planned.color, type: "planned" },
        actorId: owner.userId,
        note: null,
      });

      // Moving the item to another column moves both posts again.
      await db().delete(schema.webhookDeliveries);
      const moved = await asOwner(request(testApp.http).patch(`${prodBase()}/roadmap/${itemId}/move`)).send({
        statusId: active.id,
        targetRank: "a2",
      });
      expect(moved.status).toBe(200);
      const onMove = await events("post.status_changed");
      expect(onMove).toHaveLength(2);
      expect(onMove.every((e) => e.data.previousStatusId === planned.id && e.data.newStatus.id === active.id)).toBe(true);

      // Privacy: no roadmap internal field in any payload (D-11).
      const text = JSON.stringify((await deliveries()).map((r) => r.payload));
      for (const secret of [SECRET_TITLE, SECRET_DESC, SECRET_NOTES, ASSIGNEE_NAME]) {
        expect(text, secret).not.toContain(secret);
      }

      // Same-column rank change and editing the item to its own status emit nothing.
      await db().delete(schema.webhookDeliveries);
      await asOwner(request(testApp.http).patch(`${prodBase()}/roadmap/${itemId}/move`))
        .send({ statusId: active.id, targetRank: "a3" })
        .expect(200);
      await asOwner(request(testApp.http).patch(`${prodBase()}/roadmap/${itemId}`))
        .send({ statusId: active.id })
        .expect(200);
      expect(await events("post.status_changed")).toHaveLength(0);
    });

    it("emits on link only when the post's status actually changes", async () => {
      const item = await mkItem(planned.id);
      expect(item.status).toBe(201);
      const onPlanned = await mkPost(planned.id);
      const onOpen = await mkPost(open.id);

      await asOwner(request(testApp.http).post(`${prodBase()}/roadmap/${item.body.id}/link`))
        .send({ postId: onPlanned.id })
        .expect(201);
      expect(await events("post.status_changed")).toHaveLength(0);

      await asOwner(request(testApp.http).post(`${prodBase()}/roadmap/${item.body.id}/link`))
        .send({ postId: onOpen.id })
        .expect(201);
      const after = await events("post.status_changed");
      expect(after).toHaveLength(1);
      expect(after[0].data).toMatchObject({ postId: onOpen.id, previousStatusId: open.id });
    });
  });

  describe("post.merged", () => {
    it("emits one event per merged duplicate through the single and the bulk route", async () => {
      const keep = await mkPost(open.id);
      const dup = await mkPost(open.id);
      const single = await asOwner(request(testApp.http).post(`${prodBase()}/posts/${dup.number}/merge`)).send({
        targetNumber: keep.number,
      });
      expect(single.status).toBe(200);
      const one = await events("post.merged");
      expect(one).toHaveLength(1);
      expect(one[0].id).toMatch(EVENT_ID);
      expect(one[0].data).toEqual({
        id: dup.id,
        number: dup.number,
        mergedInto: { id: keep.id, number: keep.number },
        actorId: owner.userId,
      });

      await db().delete(schema.webhookDeliveries);
      const keep2 = await mkPost(open.id);
      const dups = [await mkPost(open.id), await mkPost(open.id), await mkPost(open.id)];
      const bulk = await asOwner(request(testApp.http).post(`${prodBase()}/posts/merge`)).send({
        keepNumber: keep2.number,
        mergeNumbers: dups.map((d) => d.number),
      });
      expect(bulk.status).toBe(200);
      const three = await events("post.merged");
      expect(three).toHaveLength(3);
      expect(three.map((e) => e.data.id).sort()).toEqual(dups.map((d) => d.id).sort());
    });

    it("emits nothing for a rejected merge", async () => {
      const keep = await mkPost(open.id);
      const gone = await mkPost(open.id, { deletedAt: new Date() });
      const dup = await mkPost(open.id);
      const self = await asOwner(request(testApp.http).post(`${prodBase()}/posts/merge`)).send({
        keepNumber: keep.number,
        mergeNumbers: [keep.number, dup.number],
      });
      expect(self.status).toBe(400);
      const deletedTarget = await asOwner(request(testApp.http).post(`${prodBase()}/posts/${dup.number}/merge`)).send({
        targetNumber: gone.number,
      });
      expect(deletedTarget.status).toBe(400);
      expect(await events("post.merged")).toHaveLength(0);
    });
  });

  describe("restores", () => {
    it("emits post.restored for a deleted post and nothing for a live one", async () => {
      const deleted = await mkPost(open.id, { deletedAt: new Date() });
      const live = await mkPost(open.id);
      await asOwner(request(testApp.http).post(`${prodBase()}/posts/${live.number}/restore`)).expect(404);
      expect(await events("post.restored")).toHaveLength(0);

      await asOwner(request(testApp.http).post(`${prodBase()}/posts/${deleted.number}/restore`)).expect(204);
      const restored = await events("post.restored");
      expect(restored).toHaveLength(1);
      expect(restored[0].id).toMatch(EVENT_ID);
      expect(restored[0].data).toEqual({ id: deleted.id, number: deleted.number, actorId: owner.userId });
    });

    it("emits comment.restored for a deleted comment and nothing for a live one", async () => {
      const post = await mkPost(open.id);
      const [deleted] = await db()
        .insert(schema.comments)
        .values({ postId: post.id, authorId: customer.userId, body: "gone", deletedAt: new Date() })
        .returning();
      const [live] = await db()
        .insert(schema.comments)
        .values({ postId: post.id, authorId: customer.userId, body: "here" })
        .returning();
      await asOwner(request(testApp.http).post(`${prodBase()}/comments/${live.id}/restore`)).expect(404);
      expect(await events("comment.restored")).toHaveLength(0);

      await asOwner(request(testApp.http).post(`${prodBase()}/comments/${deleted.id}/restore`)).expect(204);
      const restored = await events("comment.restored");
      expect(restored).toHaveLength(1);
      expect(restored[0].data).toEqual({ id: deleted.id, postId: post.id, actorId: owner.userId });
    });
  });

  describe("changelog.published fires once on the draft-to-live transition", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped" }] }] };
    const past = () => new Date(Date.now() - 2 * 60 * MIN).toISOString();
    const future = () => new Date(Date.now() + 3 * 24 * 60 * MIN).toISOString();
    const create = (body: Record<string, unknown>) =>
      asOwner(request(testApp.http).post(`${prodBase()}/changelog`)).send({ title: "Release", content: doc, ...body });
    const published = () => events("changelog.published");

    it("emits when created live, with the existing payload shape", async () => {
      const when = past();
      const res = await create({ title: "Live on creation", summary: "S", publishedAt: when });
      expect(res.status).toBe(201);
      const list = await published();
      expect(list).toHaveLength(1);
      expect(list[0].id).toMatch(EVENT_ID);
      expect(list[0].data).toEqual({ id: res.body.id, title: "Live on creation", summary: "S", publishedAt: when });
    });

    it("emits nothing for a draft or a future-dated entry", async () => {
      expect((await create({ title: "Draft" })).status).toBe(201);
      expect((await create({ title: "Later", publishedAt: future() })).status).toBe(201);
      expect(await published()).toHaveLength(0);
    });

    it("emits once when a draft is edited live, then not for edits of the live entry", async () => {
      const draft = await create({ title: "Edit me" });
      await asOwner(request(testApp.http).patch(`${prodBase()}/changelog/${draft.body.id}`))
        .send({ publishedAt: past() })
        .expect(200);
      expect(await published()).toHaveLength(1);
      await asOwner(request(testApp.http).patch(`${prodBase()}/changelog/${draft.body.id}`))
        .send({ title: "Edit me again" })
        .expect(200);
      expect(await published()).toHaveLength(1);
    });

    it("emits once on publish, not on a repeat, and again after unpublish and publish", async () => {
      const draft = await create({ title: "Publish me" });
      const publish = () => asOwner(request(testApp.http).post(`${prodBase()}/changelog/${draft.body.id}/publish`)).send({});
      await publish().expect(200);
      expect(await published()).toHaveLength(1);
      await publish().expect(200);
      expect(await published()).toHaveLength(1);
      await asOwner(request(testApp.http).post(`${prodBase()}/changelog/${draft.body.id}/unpublish`)).send({}).expect(200);
      await publish().expect(200);
      expect(await published()).toHaveLength(2);
    });
  });

  describe("inbox reply (characterization)", () => {
    it("enqueues exactly one comment.created per subscription", async () => {
      const post = await mkPost(open.id);
      const [root] = await db()
        .insert(schema.comments)
        .values({ postId: post.id, authorId: customer.userId, isAdmin: false, body: "Customer asks" })
        .returning();
      const res = await asOwner(request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/comments/${root.id}/reply`)).send({
        body: "We are on it",
      });
      expect(res.status).toBe(201);
      const rows = await deliveries("comment.created");
      expect(rows.filter((r) => r.subscriptionId === subId)).toHaveLength(1);
      expect(rows.filter((r) => r.subscriptionId === commentSubId)).toHaveLength(1);
      expect(rows).toHaveLength(2);
      expect((rows[0].payload as any).data).toMatchObject({ authorId: owner.userId, parentId: root.id, postId: post.id });
    });
  });

  describe("stable event ids", () => {
    it("re-sends the same payload id on a retry and on a redelivery", async () => {
      const post = await mkPost(open.id, { deletedAt: new Date() });
      await asOwner(request(testApp.http).post(`${prodBase()}/posts/${post.number}/restore`)).expect(204);
      const [row] = await deliveries("post.restored");
      const eventId = (row.payload as any).id as string;
      expect(eventId).toMatch(EVENT_ID);
      const sent = () => receiver.requests.filter((r) => r.deliveryId === row.id).map((r) => JSON.parse(r.body).id);

      // Attempt 1 fails with 503; the retry succeeds.
      failNext = 1;
      const t = new Date();
      await worker.runOnce(t);
      await worker.runOnce(new Date(t.getTime() + 2 * MIN));
      expect(sent()).toHaveLength(2);
      expect((await deliveries("post.restored"))[0].status).toBe("delivered");

      const redelivered = await asOwner(
        request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/webhooks/${subId}/deliveries/${row.id}/redeliver`)
      );
      expect(redelivered.status).toBe(200);
      await worker.runOnce(new Date(Date.now() + 5000));
      expect(sent()).toHaveLength(3);
      expect(new Set(sent())).toEqual(new Set([eventId]));
    });
  });
});
