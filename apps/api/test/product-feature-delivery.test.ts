import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { EmailWorker } from "../src/email/worker.js";

describe("Product availability and customer delivery", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let owner: { cookie: string; userId: string };
  let customer: { cookie: string; userId: string };
  let serial = 0;
  beforeAll(async () => {
    app = await createTestApp({ SMTP_HOST: "127.0.0.1", SMTP_PORT: 1025,
      SMTP_REQUIRE_TLS: false, SMTP_FROM: "delivery@userhq.test" });
    owner = await signedInCookie(app.test, { name: "Owner", email: "delivery-owner@test.local", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "Customer", email: "delivery-customer@test.local", emailVerified: true });
  });
  afterAll(async () => { await app?.close(); });

  async function fixture() {
    const slug = `delivery-${++serial}`;
    const [ws] = await app.db.insert(schema.workspaces).values({ name: slug, slug }).returning();
    await app.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: owner.userId, role: "owner" });
    const [product] = await app.db.insert(schema.products).values({ workspaceId: ws.id, name: slug, slug: "app" }).returning();
    const [status] = await app.db.insert(schema.statuses).values({ productId: product.id, name: "Review", type: "review", color: "#123456", position: 0, isDefault: true }).returning();
    const [post] = await app.db.insert(schema.posts).values({ productId: product.id, number: 1, title: slug, authorId: customer.userId, statusId: status.id }).returning();
    const [next] = await app.db.insert(schema.statuses).values({ productId: product.id, name: "Planned", type: "planned", color: "#123456", position: 1 }).returning();
    const admin = `/api/v1/workspaces/${slug}/products/app`;
    const portal = `/api/v1/portal/${slug}/app`;
    const toggle = async (board: boolean) => {
      const res = await request(app.http).patch(admin).set("Cookie", owner.cookie).set("Origin", app.env.PUBLIC_URL).send({ features: { board } });
      expect(res.status).toBe(200);
    };
    const comment = async () => {
      const res = await request(app.http).post(`${portal}/posts/1/comments`).set("Cookie", owner.cookie).set("Origin", app.env.PUBLIC_URL).send({ body: "Customer update" });
      expect(res.status).toBe(201);
    };
    const move = async () => {
      const [current] = await app.db.select().from(schema.posts).where(eq(schema.posts.id, post.id));
      const res = await request(app.http).put(`${admin}/posts/1/status`).set("Cookie", owner.cookie).set("Origin", app.env.PUBLIC_URL).send({ statusId: next.id, version: current.version });
      expect(res.status).toBe(200);
    };
    const list = async () => {
      const res = await request(app.http).get("/api/v1/notifications").set("Cookie", customer.cookie);
      expect(res.status).toBe(200);
      return res.body.notifications.filter((n: any) => n.post.workspaceSlug === slug);
    };
    return { ws, product, post, status, admin, portal, toggle, comment, move, list };
  }

  it("never revives queued mail or unread notifications after disabling and re-enabling", async () => {
    const f = await fixture();
    await f.comment(); await f.move();
    expect(await f.list()).toHaveLength(1);
    await f.toggle(false); await f.toggle(true);
    expect(await f.list()).toHaveLength(0);
    const result = await app.app.get(EmailWorker).runOnce(new Date(Date.now() + 25 * 3600_000));
    expect(result.sent).toBe(0);
    const content = await request(app.http).get(`${f.portal}/posts/1`).set("Cookie", owner.cookie);
    expect(content.status).toBe(200);
  });

  it("preserves read history and unrelated products when suppressing unread delivery", async () => {
    const read = await fixture(); const unread = await fixture(); const other = await fixture();
    await read.move();
    const marked = await request(app.http).post(`/api/v1/notifications/${read.post.id}/read`).set("Cookie", customer.cookie).set("Origin", app.env.PUBLIC_URL).send({});
    expect(marked.status).toBe(201);
    await unread.move(); await other.move();
    await read.toggle(false); await unread.toggle(false);
    await read.toggle(true); await unread.toggle(true);
    expect(await read.list()).toHaveLength(1);
    expect(await unread.list()).toHaveLength(0);
    expect(await other.list()).toHaveLength(1);
  });
});
