import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, sql } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { enqueueCommentEmail } from "../src/email/outbox.js";
import { enqueueWebhookEvent } from "../src/webhooks/outbox.js";

const latch = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

describe("Board disable serializes with in-flight customer delivery", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let owner: { cookie: string; userId: string };
  let customer: { cookie: string; userId: string };
  beforeAll(async () => {
    app = await createTestApp();
    owner = await signedInCookie(app.test, { name: "Owner", email: "race-owner@test.local", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "Customer", email: "race-customer@test.local", emailVerified: true });
  });
  afterAll(async () => { await app?.close(); });

  it.each(["notification", "email", "webhook"] as const)("does not revive an in-flight %s after disable and re-enable", async (kind) => {
    const slug = `delivery-race-${kind}`;
    const [ws] = await app.db.insert(schema.workspaces).values({ name: slug, slug }).returning();
    await app.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: owner.userId, role: "owner" });
    const [product] = await app.db.insert(schema.products).values({ workspaceId: ws.id, name: slug, slug: "app" }).returning();
    const [status] = await app.db.insert(schema.statuses).values({ productId: product.id, name: "Review", type: "review", color: "#123456", position: 0, isDefault: true }).returning();
    const [post] = await app.db.insert(schema.posts).values({ productId: product.id, number: 1, title: slug, authorId: customer.userId, statusId: status.id }).returning();
    const [activity] = await app.db.insert(schema.postActivity).values({ postId: post.id, actorId: owner.userId, kind: "status_changed", statusName: "Review", statusColor: "#123456" }).returning();
    const [comment] = await app.db.insert(schema.comments).values({ postId: post.id, authorId: owner.userId, body: "In-flight comment" }).returning();
    await app.db.insert(schema.webhookSubscriptions).values({ workspaceId: ws.id, url: "https://hooks.example.test/in", secret: "whsec_race", events: ["*"], isActive: true });
    const toggle = (board: boolean) => request(app.http).patch(`/api/v1/workspaces/${slug}/products/app`)
      .set("Cookie", owner.cookie).set("Origin", app.env.PUBLIC_URL).send({ features: { board } });

    const produced = latch();
    const commit = latch();
    const producer = app.db.transaction(async (tx) => {
      if (kind === "notification") {
        await app.app.get(NotificationsService).fanOutStatusChange(tx, {
          workspaceId: ws.id, productId: product.id, postId: post.id,
          postActivityId: activity.id, actorId: owner.userId,
        });
      } else if (kind === "webhook") {
        await enqueueWebhookEvent(tx, { workspaceId: ws.id, productId: product.id, eventType: "post.created", data: { id: post.id } });
      } else {
        await enqueueCommentEmail(tx, { workspaceId: ws.id, postId: post.id, commentId: comment.id, actorId: owner.userId });
      }
      produced.release();
      await commit.promise;
    });

    try {
      await produced.promise;
      let disableFinished = false;
      const disabling = toggle(false).then((res) => { disableFinished = true; return res; });
      // Wait for the competing operation to finish or reach a real PostgreSQL lock wait.
      // No timing delay or test retry: these are the two valid transaction orderings.
      const deadline = Date.now() + 5000;
      while (!disableFinished) {
        const waiting = await app.db.execute(sql`
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

      if (kind === "notification") {
        const visible = await request(app.http).get("/api/v1/notifications").set("Cookie", customer.cookie);
        expect(visible.status).toBe(200);
        expect(visible.body.notifications.filter((n: any) => n.post.workspaceSlug === slug)).toHaveLength(0);
      } else if (kind === "webhook") {
        const deliveries = await app.db.select({ status: schema.webhookDeliveries.status, errorMessage: schema.webhookDeliveries.errorMessage })
          .from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.workspaceId, ws.id));
        expect(deliveries).toEqual([{ status: "suppressed", errorMessage: "board_unavailable" }]);
      } else {
        const queued = await app.db.select({ id: schema.commentEmailItems.commentId })
          .from(schema.commentEmailItems).where(eq(schema.commentEmailItems.commentId, comment.id));
        expect(queued).toHaveLength(0);
      }
    } finally {
      commit.release();
      await producer;
    }
  });
});
