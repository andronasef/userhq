import { ModulesContainer, MetadataScanner } from "@nestjs/core";
import { RequestMethod } from "@nestjs/common";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants.js";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { ApiKeyScope } from "@userhq/types";
import { IS_PUBLIC } from "../../src/auth/decorators.js";
import { REQUIRE_SCOPES } from "../../src/api-keys/api-key.decorator.js";

export interface DiscoveredRoute {
  verb: string;
  /** Full path with the controller prefix, without the global /api/v1 prefix. */
  path: string;
  controller: string;
  handler: string;
  scopes: ApiKeyScope[];
  isPublic: boolean;
}

const asArray = (p: unknown): string[] => (Array.isArray(p) ? p : p === undefined ? [""] : [p as string]);
const trim = (p: string) => p.replace(/^\/+|\/+$/g, "");

/** Every controller route in the app, scopes read from handler then class metadata. */
export function discoverRoutes(app: NestExpressApplication): DiscoveredRoute[] {
  const scanner = new MetadataScanner();
  const routes: DiscoveredRoute[] = [];
  for (const moduleRef of app.get(ModulesContainer).values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const controllerPaths = Reflect.getMetadata(PATH_METADATA, metatype);
      if (controllerPaths === undefined) continue;
      const prototype = Object.getPrototypeOf(instance);
      for (const handlerName of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[handlerName];
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined) continue;
        const scopes: ApiKeyScope[] =
          Reflect.getMetadata(REQUIRE_SCOPES, handler) ?? Reflect.getMetadata(REQUIRE_SCOPES, metatype) ?? [];
        const isPublic = Boolean(Reflect.getMetadata(IS_PUBLIC, handler) || Reflect.getMetadata(IS_PUBLIC, metatype));
        for (const cPath of asArray(controllerPaths)) {
          for (const mPath of asArray(Reflect.getMetadata(PATH_METADATA, handler))) {
            routes.push({
              verb: RequestMethod[method],
              path: "/" + [cPath, mPath].map(trim).filter(Boolean).join("/"),
              controller: metatype.name,
              handler: handlerName,
              scopes,
              isPublic,
            });
          }
        }
      }
    }
  }
  return routes;
}
