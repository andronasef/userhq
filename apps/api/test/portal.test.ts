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

  describe("Portal Directory API (Plan 02-10)", () => {
    it("tracer: anonymous GET /api/v1/portal/:ws lists live products by name", async () => {
      const [dirWs] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: "dir-test-ws",
          name: "Directory Test WS",
          websiteUrl: "https://dir.example",
          directoryEnabled: true,
        })
        .returning();

      // Seed "Zeta" and "alpha" plus a deleted product
      await testApp.db.insert(schema.products).values([
        {
          workspaceId: dirWs.id,
          slug: "zeta",
          name: "Zeta Product",
          tagline: "The last one",
          accentColor: "#2563EB",
        },
        {
          workspaceId: dirWs.id,
          slug: "alpha",
          name: "alpha Product",
          tagline: "The first one",
          accentColor: "#10B981",
        },
        {
          workspaceId: dirWs.id,
          slug: "deleted-prod",
          name: "Deleted Product",
          deletedAt: new Date(),
        },
      ]);

      const res = await request(testApp.http).get("/api/v1/portal/dir-test-ws");
      expect(res.status).toBe(200);

      expect(res.body).toEqual({
        workspace: {
          slug: "dir-test-ws",
          name: "Directory Test WS",
          logoUrl: null,
          websiteUrl: "https://dir.example",
        },
        directoryEnabled: true,
        products: [
          {
            slug: "alpha",
            name: "alpha Product",
            tagline: "The first one",
            accentColor: "#10B981",
            logoUrl: null,
          },
          {
            slug: "zeta",
            name: "Zeta Product",
            tagline: "The last one",
            accentColor: "#2563EB",
            logoUrl: null,
          },
        ],
      });

      // Exact keys check
      expect(Object.keys(res.body).sort()).toEqual([
        "directoryEnabled",
        "products",
        "workspace",
      ]);
      expect(Object.keys(res.body.workspace).sort()).toEqual([
        "logoUrl",
        "name",
        "slug",
        "websiteUrl",
      ]);
      expect(Object.keys(res.body.products[0]).sort()).toEqual([
        "accentColor",
        "logoUrl",
        "name",
        "slug",
        "tagline",
      ]);

      // No UUID leak
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(dirWs.id);
      expect(bodyStr).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
    });

    it("directoryEnabled false is still returned", async () => {
      await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: "disabled-ws",
          name: "Disabled WS",
          directoryEnabled: false,
        });

      const res = await request(testApp.http).get("/api/v1/portal/disabled-ws");
      expect(res.status).toBe(200);
      expect(res.body.directoryEnabled).toBe(false);
    });

    it("directory for suspended workspace returns 403 workspace_suspended", async () => {
      await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: "suspended-dir-ws",
          name: "Suspended Dir WS",
          suspendedAt: new Date(),
        });

      const res = await request(testApp.http).get("/api/v1/portal/suspended-dir-ws");
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        code: "workspace_suspended",
        message: "This portal is unavailable.",
      });
    });

    it("directory for unknown workspace returns 404 not_found", async () => {
      const res = await request(testApp.http).get("/api/v1/portal/non-existent-ws");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        code: "not_found",
        message: "Not found.",
      });
    });
  });
});
