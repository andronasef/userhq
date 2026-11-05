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
    const authHeader = req.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer uhq_live_")) {
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
    if (url.startsWith("/api/auth")) {
      return true;
    }

    const authHeader = req.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer uhq_live_")) {
      const token = authHeader.slice(7).trim();
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

      req.apiKey = result.key;
      const syntheticUser = {
        id: result.key.createdByUserId ?? `apikey:${result.key.id}`,
        name: result.key.name,
        email: "apikey@userhq.internal",
        image: null,
        isApiKey: true,
      };
      req.user = syntheticUser;
      req.session = {
        user: syntheticUser,
        session: { id: `apikey_session_${result.key.id}` },
      };
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
