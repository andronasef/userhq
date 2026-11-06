import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import { IS_PUBLIC, SKIP_ORIGIN } from "./decorators.js";
import { AUTH, type Auth } from "./auth.js";
import { ENV, type Env } from "../env.js";
import { ApiException } from "../common/api-error.filter.js";
import { ApiKeyService } from "../api-keys/api-key.service.js";
import { REQUIRE_SCOPES } from "../api-keys/api-key.decorator.js";
import { apiKeyToken } from "../api-keys/authorization.js";
import type { ApiKeyScope } from "@userhq/types";

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skipOrigin = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skipOrigin) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();

    // Skip origin check for API key bearer tokens
    if (apiKeyToken(req.headers["authorization"]) !== null) {
      return true;
    }

    const url = req.originalUrl || req.url || req.path || "";
    if (url.startsWith("/api/auth")) {
      return true;
    }

    const method = req.method?.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return true;
    }

    const rawOrigin = req.headers["origin"];
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    const expectedOrigin = new URL(this.env.PUBLIC_URL).origin;

    if (!origin || origin !== expectedOrigin) {
      throw new ApiException(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Cross-site request rejected."
      );
    }

    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    private readonly apiKeyService: ApiKeyService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const url = req.originalUrl || req.url || req.path || "";
    const token = apiKeyToken(req.headers["authorization"]);
    if (url.startsWith("/api/auth") && token === null) {
      return true;
    }

    if (token !== null) {
      const result = await this.apiKeyService.validateToken(token);
      if (!result.valid) {
        if (result.error === "api_key_expired") {
          throw new ApiException(
            "api_key_expired",
            HttpStatus.UNAUTHORIZED,
            "API key has expired."
          );
        }
        if (result.error === "api_key_revoked") {
          throw new ApiException(
            "api_key_revoked",
            HttpStatus.UNAUTHORIZED,
            "API key has been revoked."
          );
        }
        throw new ApiException(
          "api_key_invalid",
          HttpStatus.UNAUTHORIZED,
          "Invalid API key."
        );
      }

      const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
        REQUIRE_SCOPES, [ctx.getHandler(), ctx.getClass()]
      );
      if (!requiredScopes?.length || url.startsWith("/api/auth")) {
        throw new ApiException("api_key_route_forbidden", 403, "API keys cannot access this route.");
      }
      if (!result.key.scopes.includes("admin") && !requiredScopes.every(scope => result.key.scopes.includes(scope))) {
        throw new ApiException("insufficient_scope", 403, "API key lacks the required scope.");
      }
      req.apiKey = result.key;
      const principal = {
        kind: "api-key" as const,
        keyId: result.key.id,
        workspaceId: result.key.workspaceId,
        scopes: result.key.scopes,
      };
      req.principal = principal;
      req.user = {
        ...await this.apiKeyService.integrationActor(result.key),
        apiPrincipal: principal,
      };
      req.session = null;
      return true;
    }

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableRefresh: true },
    });

    const active =
      session &&
      !(session.user as any).bannedAt &&
      !(session.user as any).deletedAt
        ? session
        : null;
    req.session = active;
    req.user = active?.user ?? null;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (!active) {
      throw new ApiException(
        "unauthorized",
        HttpStatus.UNAUTHORIZED,
        "Sign in to continue."
      );
    }

    return true;
  }
}
