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
});
