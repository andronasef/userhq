import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import { IS_PUBLIC } from "./decorators.js";
import { AUTH, type Auth } from "./auth.js";
import { ENV, type Env } from "../env.js";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
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
    @Inject(AUTH) private readonly auth: Auth
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const url = req.originalUrl || req.url || req.path || "";
    if (url.startsWith("/api/auth")) {
      return true;
    }

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableRefresh: true },
    });

    const active = session && !(session.user as any).bannedAt ? session : null;
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
