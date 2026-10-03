import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, and, asc } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Products API (Plan 02-08)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let otherUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@products.test",
    });

    ownerUser = await signedInCookie(testApp.test, {
      name: "Product Test Owner",
      email: "owner@products.test",
      emailVerified: true,
    });

    otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@products.test",
      emailVerified: true,
    });

    wsSlug = "ws-prod-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Product Test Workspace",
        websiteUrl: "https://ws-test.example",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: ownerUser.userId,
      role: "owner",
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: admin creates a product with five seeded statuses and edits it", async () => {
    const slug = "tracer-prod";
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Tracer Product",
        slug,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual({ slug });

    // Assert DB holds exactly 5 statuses ordered 0..4
    const [prodRow] = await testApp.db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.workspaceId, wsId), eq(schema.products.slug, slug)));
    expect(prodRow).toBeDefined();

    const dbStatuses = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodRow.id))
      .orderBy(asc(schema.statuses.position));

    expect(dbStatuses.length).toBe(5);
    expect(dbStatuses.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
    expect(dbStatuses.map((s) => s.name)).toEqual(SEEDED_STATUSES.map((s) => s.name));
    expect(dbStatuses.map((s) => s.type)).toEqual(SEEDED_STATUSES.map((s) => s.type));
    expect(dbStatuses.map((s) => s.color)).toEqual(SEEDED_STATUSES.map((s) => s.color));

    const defaultStatuses = dbStatuses.filter((s) => s.isDefault);
    expect(defaultStatuses.length).toBe(1);
    expect(defaultStatuses[0].name).toBe("Under Review");

    // GET list contains product
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products`)
      .set("Cookie", ownerUser.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((p: any) => p.slug === slug && p.name === "Tracer Product")).toBe(true);

    // PATCH edits name, tagline, websiteUrl, ignores slug
    const patchRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Renamed Tracer",
        tagline: "A snappy tagline",
        websiteUrl: "https://acme.example",
        slug: "other-slug",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.slug).toBe(slug);
    expect(patchRes.body.name).toBe("Renamed Tracer");
    expect(patchRes.body.tagline).toBe("A snappy tagline");
    expect(patchRes.body.websiteUrl).toBe("https://acme.example");

    // Anonymous portal GET returns new name
    const portalRes = await request(testApp.http).get(`/api/v1/portal/${wsSlug}/${slug}`);
    expect(portalRes.status).toBe(200);
    expect(portalRes.body.product.name).toBe("Renamed Tracer");
    expect(portalRes.body.product.tagline).toBe("A snappy tagline");
    expect(portalRes.body.product.websiteUrl).toBe("https://acme.example");
  });

  describe("Accent Color Behavior (Task 2)", () => {
    it("PATCH {accentColor: '#16a34a'} stores uppercased '#16A34A'", async () => {
      const slug = "accent-test";
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Accent Test", slug });

      const patchRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ accentColor: "#16a34a" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.accentColor).toBe("#16A34A");

      const [row] = await testApp.db
        .select({ accent: schema.products.accentColor })
        .from(schema.products)
        .where(and(eq(schema.products.workspaceId, wsId), eq(schema.products.slug, slug)));
      expect(row.accent).toBe("#16A34A");
    });

    it("PATCH {accentColor: 'blue'} returns 400 invalid_color", async () => {
      const slug = "accent-test";
      const res = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ accentColor: "blue" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_color");
    });

    it("DB CHECK rejects direct insert of lowercase '#16a34a'", async () => {
      await expect(
        testApp.db.insert(schema.products).values({
          workspaceId: wsId,
          name: "Lowercase Accent",
          slug: "lower-accent",
          accentColor: "#16a34a",
        })
      ).rejects.toThrow();
    });
  });

  describe("Deletion, Concurrency & Lifecycle (Task 3)", () => {
    it("DELETE -> 204; GET 404, list excludes it, portal 404, DB row kept with deleted_at and 5 statuses", async () => {
      const slug = "del-test";
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Del Test", slug });

      const [prodBefore] = await testApp.db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.workspaceId, wsId), eq(schema.products.slug, slug)));
      expect(prodBefore).toBeDefined();

      const delRes = await request(testApp.http)
        .delete(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(delRes.status).toBe(204);

      // GET returns 404
      const getRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
        .set("Cookie", ownerUser.cookie);
      expect(getRes.status).toBe(404);

      // List excludes it
      const listRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie);
      expect(listRes.body.some((p: any) => p.slug === slug)).toBe(false);

      // Portal 404
      const portalRes = await request(testApp.http).get(`/api/v1/portal/${wsSlug}/${slug}`);
      expect(portalRes.status).toBe(404);

      // Direct DB row has deletedAt set
      const [prodAfter] = await testApp.db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, prodBefore.id));
      expect(prodAfter.deletedAt).not.toBeNull();

      // Statuses still exist
      const statusRows = await testApp.db
        .select()
        .from(schema.statuses)
        .where(eq(schema.statuses.productId, prodBefore.id));
      expect(statusRows.length).toBe(5);

      // Repeat delete returns 404
      const repeatDelRes = await request(testApp.http)
        .delete(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(repeatDelRes.status).toBe(404);

      // Creating a product with the deleted slug returns 409 slug_taken
      const reuseRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Reuse Attempt", slug });
      expect(reuseRes.status).toBe(409);
      expect(reuseRes.body.code).toBe("slug_taken");
    });

    it("two concurrent DELETEs yield [204, 404]", async () => {
      const slug = "concurrent-del";
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Concurrent Del", slug });

      const [res1, res2] = await Promise.all([
        request(testApp.http)
          .delete(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
        request(testApp.http)
          .delete(`/api/v1/workspaces/${wsSlug}/products/${slug}`)
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([204, 404]);
    });

    it("product slug 'settings' returns 400 slug_reserved", async () => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Settings Product", slug: "settings" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("slug_reserved");
    });

    it("same product slug in workspaces A and B both return 201", async () => {
      const [otherWs] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: "ws-other-test",
          name: "Other WS",
        })
        .returning();

      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: otherWs.id,
        userId: ownerUser.userId,
        role: "owner",
      });

      const sharedSlug = "shared-prod";
      const resA = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Shared in A", slug: sharedSlug });
      expect(resA.status).toBe(201);

      const resB = await request(testApp.http)
        .post(`/api/v1/workspaces/${otherWs.slug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Shared in B", slug: sharedSlug });
      expect(resB.status).toBe(201);
    });

    it("two concurrent creates with one slug yield [201, 409] and exactly 5 statuses", async () => {
      const slug = "race-create";
      const [res1, res2] = await Promise.all([
        request(testApp.http)
          .post(`/api/v1/workspaces/${wsSlug}/products`)
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Race 1", slug }),
        request(testApp.http)
          .post(`/api/v1/workspaces/${wsSlug}/products`)
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Race 2", slug }),
      ]);

      const statusCodes = [res1.status, res2.status].sort();
      expect(statusCodes).toEqual([201, 409]);

      const [winner] = await testApp.db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.workspaceId, wsId), eq(schema.products.slug, slug)));
      expect(winner).toBeDefined();

      const statuses = await testApp.db
        .select()
        .from(schema.statuses)
        .where(eq(schema.statuses.productId, winner.id));
      expect(statuses.length).toBe(5);
    });

    it("double submit creates 201 then 409", async () => {
      const slug = "double-sub";
      const res1 = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Double Sub", slug });
      expect(res1.status).toBe(201);

      const res2 = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Double Sub", slug });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("slug_taken");
    });

    it("validations: name empty, tagline > 80 chars, invalid website url, empty string website null", async () => {
      // Empty name
      const emptyNameRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "", slug: "v-name" });
      expect(emptyNameRes.status).toBe(400);
      expect(emptyNameRes.body.code).toBe("name_required");

      // Valid product for patch tests
      const prodSlug = "v-checks";
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Validation Checks", slug: prodSlug });

      // Tagline > 80 chars
      const longTagline = "a".repeat(81);
      const taglineRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ tagline: longTagline });
      expect(taglineRes.status).toBe(400);
      expect(taglineRes.body.code).toBe("tagline_too_long");

      // Invalid website url: http:
      const httpRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ websiteUrl: "http://insecure.example" });
      expect(httpRes.status).toBe(400);
      expect(httpRes.body.code).toBe("invalid_url");

      // Invalid website url: javascript:
      const jsRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ websiteUrl: "javascript:alert(1)" });
      expect(jsRes.status).toBe(400);
      expect(jsRes.body.code).toBe("invalid_url");

      // Website empty string -> stored null
      const emptyUrlRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ websiteUrl: "" });
      expect(emptyUrlRes.status).toBe(200);
      expect(emptyUrlRes.body.websiteUrl).toBeNull();

      // Empty PATCH body -> 200 unchanged
      const emptyPatchRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({});
      expect(emptyPatchRes.status).toBe(200);
    });

    it("logo removal: PATCH {logoUploadId: null} sets logoUrl to null; foreign logo rejected", async () => {
      // Create upload owned by otherUser
      const [foreignUpload] = await testApp.db
        .insert(schema.uploads)
        .values({
          storageKey: "2026/10/foreign.webp",
          originalName: "foreign.png",
          mimeType: "image/png",
          bytes: 100,
          width: 50,
          height: 50,
          uploaderId: otherUser.userId,
        })
        .returning();

      // Try creating product with foreign logo
      const foreignCreateRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          name: "Foreign Logo",
          slug: "foreign-logo-prod",
          logoUploadId: foreignUpload.id,
        });
      expect(foreignCreateRes.status).toBe(400);
      expect(foreignCreateRes.body.code).toBe("validation_failed");

      // Create upload owned by ownerUser
      const [ownUpload] = await testApp.db
        .insert(schema.uploads)
        .values({
          storageKey: "2026/10/own.webp",
          originalName: "own.png",
          mimeType: "image/png",
          bytes: 100,
          width: 50,
          height: 50,
          uploaderId: ownerUser.userId,
        })
        .returning();

      const prodSlug = "logo-remove-test";
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          name: "Logo Remove Test",
          slug: prodSlug,
          logoUploadId: ownUpload.id,
        });

      // Verify logo is set
      const getRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie);
      expect(getRes.body.logoUrl).toBe("/uploads/2026/10/own.webp");

      // Remove logo
      const removeRes = await request(testApp.http)
        .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ logoUploadId: null });
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.logoUrl).toBeNull();
    });

    it("list order: products 'beta', 'Alpha', 'gamma' are sorted alphabetically, ties by slug", async () => {
      const [orderWs] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: "ws-order-test",
          name: "Order Test WS",
        })
        .returning();

      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: orderWs.id,
        userId: ownerUser.userId,
        role: "owner",
      });

      await request(testApp.http)
        .post(`/api/v1/workspaces/${orderWs.slug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "gamma", slug: "p-gamma" });

      await request(testApp.http)
        .post(`/api/v1/workspaces/${orderWs.slug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "beta", slug: "p-beta" });

      await request(testApp.http)
        .post(`/api/v1/workspaces/${orderWs.slug}/products`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Alpha", slug: "p-alpha" });

      const listRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${orderWs.slug}/products`)
        .set("Cookie", ownerUser.cookie);

      expect(listRes.status).toBe(200);
      const names = listRes.body.map((p: any) => p.name);
      // In default Postgres collation (C or en_US/UTF-8), let's see how they sort
      // Ascending sort by name then slug
      expect(names).toEqual(["Alpha", "beta", "gamma"]);
    });
  });
});
