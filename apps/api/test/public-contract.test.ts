import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ModulesContainer, MetadataScanner } from "@nestjs/core";
import request from "supertest";
import { createTestApp } from "./support/test-app.js";
import { Public } from "../src/auth/decorators.js";
import { PortalGuard } from "../src/portal/portal.guard.js";
import {
  PORTAL_FEATURE,
  isPortalFeatureSetting,
} from "../src/portal/product-features.js";

type App = Awaited<ReturnType<typeof createTestApp>>;

interface PortalHandler {
  id: string;
  controller: string;
  path: string;
  setting: unknown;
  hasSerializer: boolean;
  noContent: boolean;
}

/** Every handler whose combined controller + method path is under portal/:ws/:product. */
function portalProductHandlers(testApp: App): PortalHandler[] {
  const modulesContainer = testApp.app.get(ModulesContainer);
  const metadataScanner = testApp.app.get(MetadataScanner);
  const found: PortalHandler[] = [];
  for (const moduleRef of modulesContainer.values()) {
    for (const { instance, metatype } of moduleRef.controllers.values()) {
      if (!instance || !metatype) continue;
      const controllerPath = [
        Reflect.getMetadata("path", metatype) ?? "",
      ].flat()[0];
      for (const name of metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      )) {
        const handler = instance[name];
        const methodPath =
          typeof handler === "function"
            ? Reflect.getMetadata("path", handler)
            : undefined;
        if (methodPath === undefined) continue;
        const path = `/${controllerPath}/${[methodPath].flat()[0]}`
          .replace(/\/+/g, "/")
          .replace(/\/$/, "");
        if (!/^\/portal\/:ws\/:product(\/|$)/.test(path)) continue;
        const serializer =
          Reflect.getMetadata("class_serializer:options", handler) ??
          Reflect.getMetadata("class_serializer:options", metatype);
        found.push({
          id: `${metatype.name}.${name}`,
          controller: metatype.name,
          path,
          setting:
            Reflect.getMetadata(PORTAL_FEATURE, handler) ??
            Reflect.getMetadata(PORTAL_FEATURE, metatype),
          hasSerializer: !!serializer?.schema,
          noContent: Reflect.getMetadata("__httpCode__", handler) === 204,
        });
      }
    }
  }
  return found;
}

// Tested endpoint classifications (D-08/D-11). A new portal product controller must be added here
// AND declare @PortalFeature(...), otherwise this suite fails.
const EXPECTED_CLASSIFICATION: Record<string, string> = {
  PortalBadgesController: "exempt",
  PortalController: "exempt", // branding metadata only (GET /portal/:ws/:product)
  PortalPostsController: "board",
  PortalCommentsController: "board",
  PortalVotesController: "board",
  PortalMutesController: "board",
  PortalActivityController: "board",
  PortalRoadmapController: "roadmap",
  PortalChangelogController: "changelog",
  PortalFaqController: "faq",
};

describe("Public Contract Seam Test (Plan 02-05)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("every @Public() handler declares a serializer schema", () => {
    const modulesContainer = testApp.app.get(ModulesContainer);
    const metadataScanner = testApp.app.get(MetadataScanner);

    const publicRoutes: string[] = [];
    const missingSchema: string[] = [];

    for (const moduleRef of modulesContainer.values()) {
      for (const wrapper of moduleRef.controllers.values()) {
        const { instance, metatype } = wrapper;
        if (!instance || !metatype) continue;

        const controllerPath = Reflect.getMetadata("path", metatype) ?? "";
        const isClassPublic =
          Reflect.getMetadata("isPublic", metatype) === true;
        const classSerializerOpts = Reflect.getMetadata(
          "class_serializer:options",
          metatype,
        );

        const methodNames = metadataScanner.getAllMethodNames(
          Object.getPrototypeOf(instance),
        );

        for (const methodName of methodNames) {
          const handler = instance[methodName];
          if (typeof handler !== "function") continue;

          // Check if it's an HTTP route handler (has path or method metadata)
          const methodPath = Reflect.getMetadata("path", handler);
          if (methodPath === undefined) continue;

          const isHandlerPublic =
            Reflect.getMetadata("isPublic", handler) === true;
          const isPublic = isHandlerPublic || isClassPublic;

          if (!isPublic) continue;

          // Build normalized full path
          const fullPath = `/${controllerPath}/${methodPath}`
            .replace(/\/+/g, "/")
            .replace(/\/$/, "");
          publicRoutes.push(fullPath || "/");

          const serializerOpts =
            Reflect.getMetadata("class_serializer:options", handler) ??
            classSerializerOpts;

          if (!serializerOpts?.schema) {
            missingSchema.push(`${metatype.name}.${methodName}`);
          }
        }
      }
    }

    expect(
      missingSchema,
      `The following @Public handlers lack @SerializeOptions with a schema: ${missingSchema.join(", ")}`,
    ).toEqual([]);

    // Assert discovered routes include the required routes
    expect(publicRoutes).toContain("/me");
    expect(publicRoutes).toContain("/health");
    expect(publicRoutes).toContain("/portal/:ws/:product");
    expect(publicRoutes).toContain("/portal/:ws/:product/posts");
    expect(publicRoutes).toContain("/portal/:ws/:product/posts/:number");
    expect(publicRoutes).toContain("/portal/:ws/:product/roadmap");
    expect(publicRoutes).toContain("/portal/:ws/:product/roadmap/:id");
    expect(publicRoutes).toContain("/portal/:ws");
    expect(publicRoutes).toContain("/platform/invites");
    expect(publicRoutes).toContain("/unsubscribe/:token");
    expect(publicRoutes).toContain("/portal/:ws/:product/changelog");
    expect(publicRoutes).toContain("/portal/:ws/:product/changelog/:slug");
    expect(publicRoutes).toContain("/portal/:ws/:product/faq");
  });

  describe("portal product capability classification (Plan 06-03)", () => {
    it("discovers the portal product handlers (scan is not vacuous)", () => {
      const handlers = portalProductHandlers(testApp);
      expect(handlers.length).toBeGreaterThanOrEqual(15);
      expect(new Set(handlers.map((h) => h.controller))).toEqual(
        new Set(Object.keys(EXPECTED_CLASSIFICATION)),
      );
    });

    it("every portal/:ws/:product handler has a valid module or explicit exempt declaration", () => {
      const missing = portalProductHandlers(testApp).filter(
        (h) => !isPortalFeatureSetting(h.setting),
      );
      expect(missing.map((h) => h.id)).toEqual([]);
    });

    it.each(Object.entries(EXPECTED_CLASSIFICATION))(
      "%s is classified %s on all of its handlers",
      (controller, setting) => {
        const own = portalProductHandlers(testApp).filter(
          (h) => h.controller === controller,
        );
        expect(own.length).toBeGreaterThan(0);
        expect(
          own.filter((h) => h.setting !== setting).map((h) => h.id),
        ).toEqual([]);
      },
    );

    it("every portal/:ws/:product handler with a response body keeps a serializer schema", () => {
      const bare = portalProductHandlers(testApp).filter(
        (h) => !h.noContent && !h.hasSerializer,
      );
      expect(bare.map((h) => h.id)).toEqual([]);
    });

    it("the scan flags, and PortalGuard rejects, an unclassified product route", async () => {
      @Controller("portal/:ws/:product/probe")
      @Public()
      @UseGuards(PortalGuard)
      class UnclassifiedProbeController {
        @Get()
        read() {
          return { leaked: true };
        }
      }
      const probeApp = await createTestApp({
        extraControllers: [UnclassifiedProbeController],
      });
      try {
        const flagged = portalProductHandlers(probeApp).filter(
          (h) => !isPortalFeatureSetting(h.setting),
        );
        expect(flagged.map((h) => h.id)).toEqual([
          "UnclassifiedProbeController.read",
        ]);
        const res = await request(probeApp.http).get(
          "/api/v1/portal/any-ws/any-product/probe",
        );
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain("leaked");
      } finally {
        await probeApp.close();
      }
    });
  });
});
