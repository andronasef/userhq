import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ModulesContainer, MetadataScanner } from "@nestjs/core";
import { createTestApp } from "./support/test-app.js";

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
        const isClassPublic = Reflect.getMetadata("isPublic", metatype) === true;
        const classSerializerOpts = Reflect.getMetadata(
          "class_serializer:options",
          metatype
        );

        const methodNames = metadataScanner.getAllMethodNames(
          Object.getPrototypeOf(instance)
        );

        for (const methodName of methodNames) {
          const handler = instance[methodName];
          if (typeof handler !== "function") continue;

          // Check if it's an HTTP route handler (has path or method metadata)
          const methodPath = Reflect.getMetadata("path", handler);
          if (methodPath === undefined) continue;

          const isHandlerPublic = Reflect.getMetadata("isPublic", handler) === true;
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
      `The following @Public handlers lack @SerializeOptions with a schema: ${missingSchema.join(", ")}`
    ).toEqual([]);

    // Assert discovered routes include the four required routes
    expect(publicRoutes).toContain("/me");
    expect(publicRoutes).toContain("/health");
    expect(publicRoutes).toContain("/portal/:ws/:product");
    expect(publicRoutes).toContain("/platform/invites");
  });
});
