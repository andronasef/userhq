import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Private Board management with Board disabled", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string };
  let customer: { cookie: string; userId: string };
  const base = "/api/v1/workspaces/private-board/products/app";
  beforeAll(async () => {
    app = await createTestApp();
    admin = await signedInCookie(app.test, { name: "Admin", email: "admin@private-board.test", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "Customer", email: "customer@private-board.test", emailVerified: true });
    const [ws] = await app.db.insert(schema.workspaces).values({ name: "Private Board", slug: "private-board" }).returning();
    await app.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: admin.userId, role: "admin" });
    const [product] = await app.db.insert(schema.products).values({ workspaceId: ws.id, name: "App", slug: "app", boardEnabled: false }).returning();
    const [status] = await app.db.insert(schema.statuses).values({ productId: product.id, name: "Review", type: "review", color: "#123456", position: 0, isDefault: true }).returning();
    await app.db.insert(schema.posts).values([1, 2].map(number => ({ productId: product.id, number, title: `Request ${number}`, description: "Details", statusId: status.id, authorId: customer.userId })));
    const [other] = await app.db.insert(schema.workspaces).values({ name: "Other", slug: "other-private-board" }).returning();
    await app.db.insert(schema.products).values({ workspaceId: other.id, name: "App", slug: "app", boardEnabled: false });
  });
  afterAll(async () => { await app?.close(); });
  const mutate = (method: "patch" | "post" | "delete", path: string, body = {}, cookie = admin.cookie) =>
    request(app.http)[method](path).set("Cookie", cookie).set("Origin", app.env.PUBLIC_URL).send(body);

  it("lets an admin edit and soft-delete a customer's request privately", async () => {
    const edited = await mutate("patch", `${base}/posts/1`, { title: "Updated privately", description: "Details", categoryId: null, version: 1 });
    expect(edited.status).toBe(200);
    expect(edited.body.slug).toBe("updated-privately");
    const loaded = await request(app.http).get(`${base}/posts/1`).set("Cookie", admin.cookie);
    expect(loaded.body.post.title).toBe("Updated privately");
    expect((await mutate("delete", `${base}/posts/2`)).status).toBe(204);
    const deleted = await request(app.http).get(`${base}/posts?view=deleted`).set("Cookie", admin.cookie);
    expect(deleted.status).toBe(200);
    expect(deleted.body.posts.some((post: { number: number }) => post.number === 2)).toBe(true);
  });

  it("denies customers, anonymous callers and another tenant", async () => {
    expect((await mutate("delete", `${base}/posts/1`, {}, customer.cookie)).status).toBe(404);
    expect((await request(app.http).delete(`${base}/posts/1`).set("Origin", app.env.PUBLIC_URL)).status).toBe(401);
    expect((await mutate("delete", "/api/v1/workspaces/other-private-board/products/app/posts/1")).status).toBe(404);
    expect((await mutate("patch", `${base}/posts/no-number`, { title: "Valid", version: 1 })).status).toBe(404);
  });
});
