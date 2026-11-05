import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Reflector } from "@nestjs/core";
import { SetMetadata, type ExecutionContext } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { PortalGuard } from "../src/portal/portal.guard.js";
import { PORTAL_FEATURE } from "../src/portal/product-features.js";

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
type Cookie = { cookie: string; userId: string };

describe("Disabled Board at the public request boundary (CAP-03, D-08)", () => {
  let app: TestApp;
  let owner: Cookie;
  let admin: Cookie;
  let customer: Cookie;
  let stranger: Cookie;
  let ws: typeof schema.workspaces.$inferSelect;
  let productId: string;
  let postIds: { one: string; merged: string };
  let commentId: string;

  const adminBase = "/api/v1/workspaces/pf-board/products/app";
  const portal = "/api/v1/portal/pf-board/app";
  const origin = () => app.env.PUBLIC_URL;

  const call = (
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    who?: Cookie,
    body?: object
  ) => {
    let req = request(app.http)[method](path).set("Origin", origin());
    if (who) req = req.set("Cookie", who.cookie);
    return body ? req.send(body) : method === "get" ? req : req.send({});
  };

  const setBoard = async (board: boolean) => {
    const res = await call("patch", adminBase, owner, { features: { board } });
    expect(res.status).toBe(200);
    expect(res.body.features.board).toBe(board);
  };

  const readEndpoints = () => [
    { name: "GET posts (list)", path: `${portal}/posts` },
    { name: "GET posts/:number (detail)", path: `${portal}/posts/1` },
    { name: "GET posts/:number (merged redirect)", path: `${portal}/posts/2` },
  ];

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signedInCookie(app.test, { name: "Owner", email: "owner@pf-board.test", emailVerified: true });
    admin = await signedInCookie(app.test, { name: "Admin", email: "admin@pf-board.test", emailVerified: true });
    customer = await signedInCookie(app.test, { name: "Customer", email: "customer@pf-board.test", emailVerified: true });
    stranger = await signedInCookie(app.test, { name: "Stranger", email: "stranger@pf-board.test", emailVerified: true });

    [ws] = await app.db.insert(schema.workspaces).values({ name: "PF Board", slug: "pf-board" }).returning();
    await app.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: owner.userId, role: "owner" },
      { workspaceId: ws.id, userId: admin.userId, role: "admin" },
    ]);
    const [product] = await app.db.insert(schema.products).values({ workspaceId: ws.id, name: "App", slug: "app", nextPostNumber: 3 }).returning();
    productId = product.id;
    const [status] = await app.db
      .insert(schema.statuses)
      .values({ productId, name: "Review", type: "review", color: "#123456", position: 0, isDefault: true })
      .returning();
    const [one] = await app.db
      .insert(schema.posts)
      .values({ productId, number: 1, title: "Primary idea", description: "Details", statusId: status.id, authorId: customer.userId })
      .returning();
    const [merged] = await app.db
      .insert(schema.posts)
      .values({ productId, number: 2, title: "Duplicate idea", description: "Dup", statusId: status.id, authorId: customer.userId, mergedIntoId: one.id })
      .returning();
    postIds = { one: one.id, merged: merged.id };
    const [comment] = await app.db
      .insert(schema.comments)
      .values({ postId: one.id, authorId: customer.userId, body: "Seed comment" })
      .returning();
    commentId = comment.id;

    // Same workspace, second product and another tenant, both with Board on.
    await app.db.insert(schema.products).values({ workspaceId: ws.id, name: "Sibling", slug: "sibling" });
    const [other] = await app.db.insert(schema.workspaces).values({ name: "PF Other", slug: "pf-other" }).returning();
    await app.db.insert(schema.products).values({ workspaceId: other.id, name: "App", slug: "app" });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("serves Board reads (list, detail, merged redirect) while enabled", async () => {
    for (const e of readEndpoints()) {
      const res = await call("get", e.path);
      expect(res.status, e.name).toBe(200);
    }
    const redirect = await call("get", `${portal}/posts/2`);
    expect(redirect.body.kind).toBe("redirect");
  });

  it("returns uniform not_found for every caller on every Board read when disabled", async () => {
    await setBoard(false);
    for (const e of readEndpoints()) {
      for (const who of [undefined, customer, stranger, admin, owner]) {
        const res = await call("get", e.path, who);
        expect(res.status, `${e.name} as ${who ? who.userId : "anonymous"}`).toBe(404);
        expect(res.body.code, e.name).toBe("not_found");
      }
    }
  });

  it("keeps product branding metadata and the workspace directory reachable when disabled", async () => {
    const meta = await call("get", portal);
    expect(meta.status).toBe(200);
    expect(meta.body.product.features.board).toBe(false);
    expect(meta.body.product.name).toBe("App");
    const directory = await call("get", "/api/v1/portal/pf-board");
    expect(directory.status).toBe(200);
    expect(directory.body.products.map((p: { slug: string }) => p.slug)).toContain("app");
  });

  it("keeps scoped admin Board management usable while disabled (D-09)", async () => {
    const list = await call("get", `${adminBase}/posts`, admin);
    expect(list.status).toBe(200);
    expect(list.body.posts.some((p: { number: number }) => p.number === 1)).toBe(true);
    const detail = await call("get", `${adminBase}/posts/1`, admin);
    expect(detail.status).toBe(200);
  });

  it("does not disable another product in the same workspace or another tenant", async () => {
    expect((await call("get", "/api/v1/portal/pf-board/sibling/posts")).status).toBe(200);
    expect((await call("get", "/api/v1/portal/pf-other/app/posts")).status).toBe(200);
  });

  it("restores Board reads with content intact after re-enable", async () => {
    await setBoard(true);
    const list = await call("get", `${portal}/posts`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain("Primary idea");
    expect((await call("get", `${portal}/posts/1`)).status).toBe(200);
  });

  describe("PortalGuard classification fixture", () => {
    class Unclassified { read() {} }
    class Classified { read() {} }
    SetMetadata(PORTAL_FEATURE, "exempt")(Classified);
    const ctxFor = (cls: new () => object, params: Record<string, string>) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ params }) }),
        getClass: () => cls,
        getHandler: () => cls.prototype.read,
      }) as unknown as ExecutionContext;
    const params = { ws: "pf-board", product: "app" };

    it("rejects a product route with no classification, even for a real tenant", async () => {
      const guard = new PortalGuard(app.db, new Reflector());
      await expect(guard.canActivate(ctxFor(Unclassified, params))).rejects.toThrow(/missing @PortalFeature/);
    });

    it("accepts the same route once classified, and workspace-only routes need no classification", async () => {
      const guard = new PortalGuard(app.db, new Reflector());
      await expect(guard.canActivate(ctxFor(Classified, params))).resolves.toBe(true);
      await expect(guard.canActivate(ctxFor(Unclassified, { ws: "pf-board" }))).resolves.toBe(true);
    });
  });

  // ---- Task 2: writes, activity (CAP-03) ----
  describe("Board writes and activity when disabled", () => {
    const snapshot = async () => {
      const count = async (table: any, where: any) => {
        const [{ n }] = await app.db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
        return n;
      };
      const posts = await app.db.select().from(schema.posts).where(eq(schema.posts.productId, productId)).orderBy(schema.posts.number);
      const postIdList = posts.map((p) => p.id);
      return {
        posts: posts.map((p) => ({ n: p.number, title: p.title, v: p.version, del: p.deletedAt, votes: p.voteCount })),
        comments: await app.db.select({ id: schema.comments.id, body: schema.comments.body, del: schema.comments.deletedAt, v: schema.comments.version }).from(schema.comments).where(inArray(schema.comments.postId, postIdList)).orderBy(schema.comments.id),
        votes: await count(schema.votes, inArray(schema.votes.postId, postIdList)),
        mutes: await count(schema.postMutes, inArray(schema.postMutes.postId, postIdList)),
        visits: await count(schema.userProductActivityVisits, eq(schema.userProductActivityVisits.productId, productId)),
      };
    };

    const writes = () => [
      { name: "POST posts", method: "post" as const, path: `${portal}/posts`, body: { title: "Brand new idea", description: "d" } },
      { name: "PATCH posts/:number", method: "patch" as const, path: `${portal}/posts/1`, body: { title: "Edited", description: null, version: 1 } },
      { name: "DELETE posts/:number", method: "delete" as const, path: `${portal}/posts/1` },
      { name: "POST posts/:number/comments", method: "post" as const, path: `${portal}/posts/1/comments`, body: { body: "A reply" } },
      { name: "PATCH comments/:id", method: "patch" as const, path: `${portal}/comments/${commentId}`, body: { body: "Edited comment", version: 1 } },
      { name: "DELETE comments/:id", method: "delete" as const, path: `${portal}/comments/${commentId}` },
      { name: "PUT posts/:number/vote", method: "put" as const, path: `${portal}/posts/1/vote` },
      { name: "DELETE posts/:number/vote", method: "delete" as const, path: `${portal}/posts/1/vote` },
      { name: "PUT posts/:number/mute", method: "put" as const, path: `${portal}/posts/1/mute` },
      { name: "DELETE posts/:number/mute", method: "delete" as const, path: `${portal}/posts/1/mute` },
    ];

    it("accepts a Board write, a vote, a mute and an activity read while enabled", async () => {
      const comment = await call("post", `${portal}/posts/1/comments`, customer, { body: "Enabled reply" });
      expect(comment.status).toBe(201);
      expect((await call("put", `${portal}/posts/1/vote`, stranger)).status).toBeLessThan(300);
      expect((await call("put", `${portal}/posts/1/mute`, stranger)).status).toBeLessThan(300);
      const activity = await call("get", `${portal}/activity`, customer);
      expect(activity.status).toBe(200);
      // restore the neutral state for the disabled matrix
      await call("delete", `${portal}/posts/1/vote`, stranger);
      await call("delete", `${portal}/posts/1/mute`, stranger);
      await app.db.delete(schema.userProductActivityVisits).where(eq(schema.userProductActivityVisits.productId, productId));
      await app.db.delete(schema.comments).where(and(eq(schema.comments.postId, postIds.one), eq(schema.comments.body, "Enabled reply")));
    });

    it("denies every Board write and activity read for every role with no row changes", async () => {
      await setBoard(false);
      const before = await snapshot();
      for (const who of [customer, stranger, admin, owner]) {
        for (const w of writes()) {
          const res = await call(w.method, w.path, who, w.body);
          expect(res.status, `${w.name} as ${who.userId}`).toBe(404);
          expect(res.body.code, w.name).toBe("not_found");
        }
        const activity = await call("get", `${portal}/activity`, who);
        expect(activity.status, "GET activity").toBe(404);
      }
      expect(await snapshot()).toEqual(before);
      expect(before.visits).toBe(0);
    });

    it("answers unauthenticated writes with the same 401 as an enabled product", async () => {
      for (const w of writes()) {
        expect((await call(w.method, w.path, undefined, w.body)).status, w.name).toBe(401);
      }
      expect((await call("get", `${portal}/activity`)).status).toBe(401);
    });

    it("keeps admin comment management usable and restores portal writes on re-enable", async () => {
      const reply = await call("post", `${adminBase}/posts/1/comments`, admin, { body: "Private admin reply" });
      expect(reply.status).toBe(201);
      await setBoard(true);
      const live = await call("post", `${portal}/posts/1/comments`, customer, { body: "Back online" });
      expect(live.status).toBe(201);
      expect((await call("get", `${portal}/activity`, customer)).status).toBe(200);
    });
  });
});
