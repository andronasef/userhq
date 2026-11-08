import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
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
});
