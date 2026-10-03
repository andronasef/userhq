import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { ModulesContainer, MetadataScanner } from "@nestjs/core";
import { RequestMethod } from "@nestjs/common";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants.js";
import { IS_PUBLIC } from "../src/auth/decorators.js";
import { createTestApp } from "./support/test-app.js";
import { seedTenants, type Seed } from "./support/seed.js";

const CROSS_TENANT_ROUTES: Record<
  string,
  (s: Seed) => { url: string; body?: unknown; method?: string }
> = {
  "GET /workspaces/:ws": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}`,
  }),
  "GET /workspaces/:ws/members": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/members`,
  }),
  "DELETE /workspaces/:ws/members/:userId": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/members/${s.b.memberUserId}`,
  }),
  "POST /workspaces/:ws/leave": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/leave`,
  }),
  "GET /workspaces/:ws/invites": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/invites`,
  }),
  "POST /workspaces/:ws/invites": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/invites`,
    body: { email: "other@example.com" },
  }),
  "DELETE /workspaces/:ws/invites/:id": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/invites/${s.b.inviteId}`,
  }),
  "POST /workspaces/:ws/products": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products`,
    body: { name: "Test Product", slug: "p-test" },
  }),
  "GET /workspaces/:ws/products": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products`,
  }),
  "GET /workspaces/:ws/products/:product": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}`,
  }),
  "PATCH /workspaces/:ws/products/:product": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}`,
    body: { name: "Changed" },
  }),
  "DELETE /workspaces/:ws/products/:product": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}`,
  }),
  "GET /workspaces/:ws/products/:product/statuses": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses`,
  }),
  "POST /workspaces/:ws/products/:product/statuses": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses`,
    body: { name: "New Status", type: "review", color: "#6B7280" },
  }),
  "PATCH /workspaces/:ws/products/:product/statuses/:statusId": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses/${s.b.statusId}`,
    body: { name: "Updated Status" },
  }),
  "PUT /workspaces/:ws/products/:product/statuses/:statusId/default": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses/${s.b.statusId}/default`,
  }),
  "PUT /workspaces/:ws/products/:product/statuses/order": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses/order`,
    body: { ids: [s.b.statusId!] },
  }),
  "DELETE /workspaces/:ws/products/:product/statuses/:statusId": (s) => ({
    url: `/api/v1/workspaces/${s.b.slug}/products/${s.b.productSlug}/statuses/${s.b.statusId}?moveTo=${s.b.statusId}`,
  }),
};

describe("Cross-tenant 404 isolation (Plan 02-03)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let seed: Seed;
  let discoveredRoutes: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
    seed = await seedTenants(testApp);

    const modulesContainer = testApp.app.get(ModulesContainer);
    const metadataScanner = new MetadataScanner();
    const routeSet = new Set<string>();

    for (const moduleRef of modulesContainer.values()) {
      for (const controllerWrapper of moduleRef.controllers.values()) {
        const { instance, metatype } = controllerWrapper;
        if (!instance || !metatype) continue;

        const isPublicClass = Reflect.getMetadata(IS_PUBLIC, metatype);
        const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype);
        if (!controllerPath) continue;

        const prototype = Object.getPrototypeOf(instance);
        const methodNames = metadataScanner.getAllMethodNames(prototype);

        for (const methodName of methodNames) {
          const handler = prototype[methodName];
          const isPublicHandler = Reflect.getMetadata(IS_PUBLIC, handler);
          if (isPublicClass || isPublicHandler) continue;

          const methodPath = Reflect.getMetadata(PATH_METADATA, handler);
          const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
          if (requestMethod === undefined) continue;

          const verb = RequestMethod[requestMethod];
          const cPath = Array.isArray(controllerPath) ? controllerPath[0] : controllerPath;
          const mPath = methodPath ? (Array.isArray(methodPath) ? methodPath[0] : methodPath) : "";
          const fullPath = "/" + [cPath, mPath].map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");

          if (fullPath.includes(":ws")) {
            routeSet.add(`${verb} ${fullPath}`);
          }
        }
      }
    }

    discoveredRoutes = Array.from(routeSet).sort();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("discovered :ws routes equal CROSS_TENANT_ROUTES keys", () => {
    const configuredKeys = Object.keys(CROSS_TENANT_ROUTES).sort();
    const missing = discoveredRoutes.filter((r) => !CROSS_TENANT_ROUTES[r]);

    expect(
      missing,
      `Missing routes in CROSS_TENANT_ROUTES: ${missing.join(", ")}. Add the new :ws route to CROSS_TENANT_ROUTES.`
    ).toEqual([]);

    expect(configuredKeys).toEqual(discoveredRoutes);
  });

  for (const [routeKey, getReq] of Object.entries(CROSS_TENANT_ROUTES)) {
    it(`cross-tenant isolation for ${routeKey}: returns 404 to foreign tenant`, async () => {
      const [verb] = routeKey.split(" ");
      const { url, body } = getReq(seed);

      const req = request(testApp.http);
      let r: request.Test;

      switch (verb) {
        case "GET":
          r = req.get(url);
          break;
        case "POST":
          r = req.post(url).send(body as any);
          break;
        case "PATCH":
          r = req.patch(url).send(body as any);
          break;
        case "PUT":
          r = req.put(url).send(body as any);
          break;
        case "DELETE":
          r = req.delete(url);
          break;
        default:
          throw new Error(`Unsupported method: ${verb}`);
      }

      const res = await r
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("not_found");
    });
  }

  it("workspace A's slug with workspace B's product slug returns 404", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${seed.a.slug}/products/${seed.b.productSlug}`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("workspace A's own product with workspace B's statusId returns 404 on PATCH, PUT default, and DELETE", async () => {
    // PATCH
    const patchRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${seed.a.slug}/products/${seed.a.productSlug}/statuses/${seed.b.statusId}`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Hacked" });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.code).toBe("not_found");

    // PUT default
    const putRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${seed.a.slug}/products/${seed.a.productSlug}/statuses/${seed.b.statusId}/default`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(putRes.status).toBe(404);
    expect(putRes.body.code).toBe("not_found");

    // DELETE
    const delRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${seed.a.slug}/products/${seed.a.productSlug}/statuses/${seed.b.statusId}?moveTo=${seed.a.statusId}`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delRes.status).toBe(404);
    expect(delRes.body.code).toBe("not_found");
  });
});

