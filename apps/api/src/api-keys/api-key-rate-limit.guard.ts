import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { InjectThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { API_KEY_RATE_LIMIT } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

/**
 * Per-key sliding-window limit on the shared throttler storage.
 *
 * Runs after SessionGuard, because req.apiKey exists only once the key and its scope
 * are validated; humans and invalid tokens never reach a bucket. We call the storage
 * directly instead of a named ThrottlerGuard throttler because that would emit
 * `Retry-After-api-key`, not `Retry-After`.
 *
 * ponytail: storage is in memory per API process, which is exact with the single
 * replica deployed today. Before running more than one, swap in a shared store.
 */
@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  constructor(@InjectThrottlerStorage() private readonly storage: ThrottlerStorage) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const key = http.getRequest().apiKey;
    if (!key) return true;

    const { limit, windowSeconds } = API_KEY_RATE_LIMIT;
    const record = await this.storage.increment(
      `api-key:${key.id}`,
      windowSeconds * 1000,
      limit,
      0,
      "api-key"
    );
    if (!record.isBlocked) return true;

    const retryAfter = Math.max(1, record.timeToBlockExpire);
    http.getResponse().setHeader("Retry-After", String(retryAfter));
    throw new ApiException(
      "rate_limited",
      429,
      `Too many requests for this API key. Retry in ${retryAfter} seconds.`
    );
  }
}
