import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { eq, ne, sql } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

const BASE = new Date("2040-01-01T00:00:00.000Z");
const DUE = new Date("2040-01-01T00:01:00.000Z");
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shipped" }] }] };

describe("scheduled changelog announcements", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let owner: { cookie: string; userId: string };
  let workspace: typeof schema.workspaces.$inferSelect;
  let product: typeof schema.products.$inferSelect;
  let subscription: typeof schema.webhookSubscriptions.$inferSelect;
  const path = () => `/api/v1/workspaces/${workspace.slug}/products/${product.slug}/changelog`;
  const asOwner = (r: request.Test) => r.set("Cookie", owner.cookie).set("Origin", app.env.PUBLIC_URL);
  const deliveries = () => app.db.select().from(schema.webhookDeliveries);
  const scheduler = async () => {
    const { ChangelogScheduler } = await import("../src/changelog/changelog.scheduler.js");
    return app.app.get(ChangelogScheduler);
  };
  const create = async (body: Record<string, unknown>) => {
    const response = await asOwner(request(app.http).post(path())).send({ title: "Scheduled release", content: doc, ...body });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body;
  };

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signedInCookie(app.test, { name: "Owner", email: "scheduled@example.test", emailVerified: true });
    [workspace] = await app.db.insert(schema.workspaces).values({ name: "Scheduled", slug: "scheduled" }).returning();
    await app.db.insert(schema.workspaceMembers).values({ workspaceId: workspace.id, userId: owner.userId, role: "owner" });
    [product] = await app.db.insert(schema.products).values({ workspaceId: workspace.id, name: "Product", slug: "product" }).returning();
    [subscription] = await app.db.insert(schema.webhookSubscriptions).values({ workspaceId: workspace.id, url: "https://receiver.example.test/hook", secret: "fixture-secret", events: ["changelog.published"] }).returning();
  });
  beforeEach(async () => {
    await app.db.delete(schema.webhookDeliveries);
    await app.db.delete(schema.changelogEntries);
    await app.db.delete(schema.products).where(ne(schema.products.id, product.id));
    await app.db.delete(schema.workspaces).where(ne(schema.workspaces.id, workspace.id));
    await app.db.update(schema.products).set({ changelogEnabled: true, deletedAt: null }).where(eq(schema.products.id, product.id));
    await app.db.update(schema.workspaces).set({ deletedAt: null }).where(eq(schema.workspaces.id, workspace.id));
  });
  afterAll(async () => { await app?.close(); });

  it("announces a future entry once when the controlled due date arrives", async () => {
    const entry = await create({ summary: "Release value", publishedAt: DUE.toISOString() });
    expect(await deliveries()).toHaveLength(0);
    const job = await scheduler();
    expect(await job.tick(BASE)).toBe(0);
    expect(await deliveries()).toHaveLength(0);
    expect(await job.tick(DUE)).toBe(1);
    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subscriptionId: subscription.id, workspaceId: workspace.id, eventType: "changelog.published", status: "pending" });
    expect(rows[0].payload.data).toEqual({ id: entry.id, title: "Scheduled release", summary: "Release value", publishedAt: DUE.toISOString() });
    expect(await job.tick(new Date(DUE.getTime() + 60_000))).toBe(0);
    expect(await deliveries()).toHaveLength(1);
    const [stored] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, entry.id));
    expect(stored.announcedAt?.toISOString()).toBe(DUE.toISOString());
  });

  it("does not re-announce an entry created live or claim a draft", async () => {
    const live = await create({ publishedAt: "2020-01-01T00:00:00.000Z" });
    await create({ title: "Draft release" });
    expect(await deliveries()).toHaveLength(1);
    expect(await (await scheduler()).tick(DUE)).toBe(0);
    expect(await deliveries()).toHaveLength(1);
    const [stored] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, live.id));
    expect(stored.announcedAt).not.toBeNull();
  });

  it("re-arms an announced entry when rescheduled or unpublished and published later", async () => {
    const entry = await create({ publishedAt: "2020-01-01T00:00:00.000Z" });
    const job = await scheduler();
    await asOwner(request(app.http).patch(`${path()}/${entry.id}`)).send({ title: "Edited while live" }).expect(200);
    expect(await deliveries()).toHaveLength(1);
    await asOwner(request(app.http).patch(`${path()}/${entry.id}`)).send({ publishedAt: DUE.toISOString() }).expect(200);
    expect(await job.tick(DUE)).toBe(1);
    expect(await deliveries()).toHaveLength(2);
    await asOwner(request(app.http).post(`${path()}/${entry.id}/unpublish`)).send({}).expect(200);
    const [unpublished] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, entry.id));
    expect(unpublished.announcedAt).toBeNull();
    const next = new Date(DUE.getTime() + 60_000);
    await asOwner(request(app.http).post(`${path()}/${entry.id}/publish`)).send({ publishedAt: next.toISOString() }).expect(200);
    expect(await job.tick(DUE)).toBe(0);
    expect(await job.tick(next)).toBe(1);
    expect(await deliveries()).toHaveLength(3);
  });

  it("claims once across two instances and skips an overlapping call on the same instance", async () => {
    await create({ publishedAt: DUE.toISOString() });
    const job = await scheduler();
    const { ChangelogScheduler } = await import("../src/changelog/changelog.scheduler.js");
    const other = new ChangelogScheduler(app.db, app.env);
    const counts = await Promise.all([job.tick(DUE), job.tick(DUE), other.tick(DUE)]);
    expect(counts[1]).toBeNull();
    expect((counts[0] ?? 0) + (counts[2] ?? 0)).toBe(1);
    expect(await deliveries()).toHaveLength(1);
  });

  it("deduplicates a scheduled claim racing with an HTTP publish request", async () => {
    const entry = await create({ publishedAt: DUE.toISOString() });
    await Promise.all([
      (await scheduler()).tick(DUE),
      asOwner(request(app.http).post(`${path()}/${entry.id}/publish`)).send({}).expect(200),
    ]);
    expect(await deliveries()).toHaveLength(1);
  });

  it("consumes a disabled product's due event without replaying it after re-enable", async () => {
    const entry = await create({ publishedAt: DUE.toISOString() });
    await app.db.update(schema.products).set({ changelogEnabled: false }).where(eq(schema.products.id, product.id));
    const job = await scheduler();
    expect(await job.tick(DUE)).toBe(1);
    expect(await deliveries()).toHaveLength(0);
    const [stored] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, entry.id));
    expect(stored.announcedAt).not.toBeNull();
    await app.db.update(schema.products).set({ changelogEnabled: true }).where(eq(schema.products.id, product.id));
    expect(await job.tick(new Date(DUE.getTime() + 60_000))).toBe(0);
    expect(await deliveries()).toHaveLength(0);
  });

  it("routes each due entry only to subscriptions in its own workspace", async () => {
    const first = await create({ publishedAt: DUE.toISOString() });
    const [otherWorkspace] = await app.db.insert(schema.workspaces).values({ name: "Other", slug: "other" }).returning();
    const [otherProduct] = await app.db.insert(schema.products).values({ workspaceId: otherWorkspace.id, name: "Other", slug: "other" }).returning();
    const [otherSubscription] = await app.db.insert(schema.webhookSubscriptions).values({ workspaceId: otherWorkspace.id, url: "https://receiver.example.test/other", secret: "other-fixture-secret", events: ["changelog.published"] }).returning();
    const [second] = await app.db.insert(schema.changelogEntries).values({ productId: otherProduct.id, title: "Other release", slug: "other-release", content: doc, publishedAt: DUE }).returning();
    expect(await (await scheduler()).tick(DUE)).toBe(2);
    const rows = await deliveries();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.subscriptionId === subscription.id)).toMatchObject({ workspaceId: workspace.id, payload: { data: { id: first.id }, product: { id: product.id } } });
    expect(rows.find((r) => r.subscriptionId === otherSubscription.id)).toMatchObject({ workspaceId: otherWorkspace.id, payload: { data: { id: second.id }, product: { id: otherProduct.id } } });
  });

  it("does not claim entries of soft-deleted products or workspaces", async () => {
    const entry = await create({ publishedAt: DUE.toISOString() });
    const job = await scheduler();
    await app.db.update(schema.products).set({ deletedAt: new Date() }).where(eq(schema.products.id, product.id));
    expect(await job.tick(DUE)).toBe(0);
    await app.db.update(schema.products).set({ deletedAt: null }).where(eq(schema.products.id, product.id));
    await app.db.update(schema.workspaces).set({ deletedAt: new Date() }).where(eq(schema.workspaces.id, workspace.id));
    expect(await job.tick(DUE)).toBe(0);
    expect(await deliveries()).toHaveLength(0);
    const [stored] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, entry.id));
    expect(stored.announcedAt).toBeNull();
  });

  it("backfills only existing live entries idempotently without retroactive events", async () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    const priorClaim = new Date("2021-01-01T00:00:00.000Z");
    const [live, future, draft, alreadyClaimed] = await app.db.insert(schema.changelogEntries).values([
      { productId: product.id, title: "Old live", slug: "old-live", content: doc, publishedAt: old },
      { productId: product.id, title: "Future", slug: "future", content: doc, publishedAt: DUE },
      { productId: product.id, title: "Draft", slug: "draft", content: doc },
      { productId: product.id, title: "Claimed", slug: "claimed", content: doc, publishedAt: old, announcedAt: priorClaim },
    ]).returning();
    const addition = readFileSync(new URL("../../../packages/db/migrations/0021_changelog_announced_at.sql", import.meta.url), "utf8");
    expect(addition.trim()).toBe('ALTER TABLE "changelog_entries" ADD COLUMN "announced_at" timestamp with time zone;');
    const backfill = readFileSync(new URL("../../../packages/db/migrations/0022_backfill_changelog_announced.sql", import.meta.url), "utf8");
    expect(backfill).not.toMatch(/\b(?:ALTER|CREATE|DROP)\s/i);
    await app.db.execute(sql.raw(backfill));
    const first = await app.db.select().from(schema.changelogEntries).orderBy(schema.changelogEntries.id);
    expect(first.find((r) => r.id === live.id)?.announcedAt).toEqual(old);
    expect(first.find((r) => r.id === future.id)?.announcedAt).toBeNull();
    expect(first.find((r) => r.id === draft.id)?.announcedAt).toBeNull();
    expect(first.find((r) => r.id === alreadyClaimed.id)?.announcedAt).toEqual(priorClaim);
    await app.db.execute(sql.raw(backfill));
    expect(await app.db.select().from(schema.changelogEntries).orderBy(schema.changelogEntries.id)).toEqual(first);
    expect(await (await scheduler()).tick(new Date())).toBe(0);
    expect(await deliveries()).toHaveLength(0);
  });

  it("keeps the durable marker out of admin and public response bodies", async () => {
    const entry = await create({ publishedAt: "2020-01-01T00:00:00.000Z" });
    const responses = [
      { status: 201, body: entry },
      await asOwner(request(app.http).get(path())),
      await asOwner(request(app.http).get(`${path()}/${entry.id}`)),
      await request(app.http).get(`/api/v1/portal/${workspace.slug}/${product.slug}/changelog`),
      await request(app.http).get(`/api/v1/portal/${workspace.slug}/${product.slug}/changelog/${entry.slug}`),
    ];
    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(JSON.stringify(response.body)).not.toMatch(/announced_?at/i);
    }
  });

  it("processes at most 100 entries per tick and leaves the remainder for the next tick", async () => {
    await app.db.insert(schema.changelogEntries).values(Array.from({ length: 101 }, (_, index) => ({
      productId: product.id, title: `Release ${index}`, slug: `release-${index}`, content: doc, publishedAt: DUE,
    })));
    const job = await scheduler();
    expect(await job.tick(DUE)).toBe(100);
    expect(await deliveries()).toHaveLength(100);
    expect(await job.tick(DUE)).toBe(1);
    expect(await deliveries()).toHaveLength(101);
  });

  it("rolls back the claim when outbox insertion fails and retries on the next tick", async () => {
    const entry = await create({ publishedAt: DUE.toISOString() });
    const job = await scheduler();
    await app.db.execute(sql.raw(`
      CREATE FUNCTION reject_scheduled_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'outbox unavailable'; END; $$;
      CREATE TRIGGER reject_scheduled_delivery BEFORE INSERT ON webhook_deliveries
      FOR EACH ROW EXECUTE FUNCTION reject_scheduled_delivery();
    `));
    try {
      await expect(job.tick(DUE)).rejects.toThrow();
      const [stored] = await app.db.select().from(schema.changelogEntries).where(eq(schema.changelogEntries.id, entry.id));
      expect(stored.announcedAt).toBeNull();
      expect(await deliveries()).toHaveLength(0);
    } finally {
      await app.db.execute(sql.raw("DROP TRIGGER reject_scheduled_delivery ON webhook_deliveries; DROP FUNCTION reject_scheduled_delivery();"));
    }
    expect(await job.tick(DUE)).toBe(1);
    expect(await deliveries()).toHaveLength(1);
  });
});
