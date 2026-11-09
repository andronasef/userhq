import {
  Injectable,
  Inject,
  Logger,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from "@nestjs/common";
import type { Response } from "express";
import { ENV, type Env } from "../env.js";
import { BadgesService } from "./badges.service.js";
import {
  attributionCookieName,
  attributionCookieOptions,
} from "./attribution.js";

@Injectable()
export class AttributionBindInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AttributionBindInterceptor.name);
  constructor(
    private readonly badges: BadgesService,
    @Inject(ENV) private readonly env: Env,
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse<Response>();
    if (req.portal?.productId && req.user?.id) {
      try {
        const { present } = await this.badges.bindPendingAttribution(
          req.portal.productId,
          req.user.id,
          req.headers.cookie,
        );
        if (present)
          res.clearCookie(
            attributionCookieName(req.portal.productId),
            attributionCookieOptions(this.env),
          );
      } catch {
        this.logger.warn("Pending badge attribution could not be bound.");
      }
    }
    return next.handle();
  }
}
