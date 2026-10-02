import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createTestApp } from "./support/test-app.js";

describe("Portal API (Plan 02-02)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let workspaceId: string;
  let productId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: "acme",
        name: "Acme",
        websiteUrl: "https://acme.example",
      })
      .returning();
    workspaceId = ws.id;

    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: "app",
        name: "Acme App",
        accentColor: "#2563EB",
      })
      .returning();
    productId = prod.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: anonymous GET /api/v1/portal/acme/app returns the allowlisted DTO", async () => {
    const res = await request(testApp.http).get("/api/v1/portal/acme/app");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      workspace: {
        slug: "acme",
        name: "Acme",
      },
      product: {
        slug: "app",
        name: "Acme App",
        tagline: null,
        accentColor: "#2563EB",
        logoUrl: null,
        websiteUrl: "https://acme.example",
      },
    });

    expect(Object.keys(res.body)).toEqual(["workspace", "product"]);
    expect(Object.keys(res.body.workspace).sort()).toEqual(["name", "slug"]);
    expect(Object.keys(res.body.product).sort()).toEqual([
      "accentColor",
      "logoUrl",
      "name",
      "slug",
      "tagline",
      "websiteUrl",
    ]);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(workspaceId);
    expect(bodyStr).not.toContain(productId);
  });

  it("unknown workspace returns 404 not_found", async () => {
    const res = await request(testApp.http).get("/api/v1/portal/unknown-ws/app");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "not_found",
      message: "Not found.",
    });
  });

  it("unknown product returns 404 not_found", async () => {
    const res = await request(testApp.http).get("/api/v1/portal/acme/unknown-product");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "not_found",
      message: "Not found.",
    });
  });

  it("soft-deleted product returns 404 not_found", async () => {
    await testApp.db
      .insert(schema.products)
      .values({
        workspaceId,
        slug: "deleted-prod",
        name: "Deleted Prod",
        deletedAt: new Date(),
      })
      .returning();

    const res = await request(testApp.http).get(
      "/api/v1/portal/acme/deleted-prod"
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "not_found",
      message: "Not found.",
    });
  });

  it("suspended workspace returns 403 workspace_suspended", async () => {
    const [suspendedWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: "suspended-ws",
        name: "Suspended WS",
        suspendedAt: new Date(),
      })
      .returning();

    await testApp.db.insert(schema.products).values({
      workspaceId: suspendedWs.id,
      slug: "some-prod",
      name: "Some Prod",
    });

    const res = await request(testApp.http).get(
      "/api/v1/portal/suspended-ws/some-prod"
    );
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      code: "workspace_suspended",
      message: "This portal is unavailable.",
    });
  });

  it("logo fallback to workspace logo and no upload uuid leak", async () => {
    const [upload] = await testApp.db
      .insert(schema.uploads)
      .values({
        storageKey: "2026/10/workspace-logo.webp",
        originalName: "logo.png",
        mimeType: "image/png",
        bytes: 1234,
        width: 100,
        height: 100,
      })
      .returning();

    await testApp.db
      .update(schema.workspaces)
      .set({ logoUploadId: upload.id })
      .where(eq(schema.workspaces.id, workspaceId));

    const res = await request(testApp.http).get("/api/v1/portal/acme/app");
    expect(res.status).toBe(200);
    expect(res.body.product.logoUrl).toBe("/uploads/2026/10/workspace-logo.webp");

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(upload.id);
  });
});
