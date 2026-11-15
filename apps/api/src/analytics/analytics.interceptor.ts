import {
  Inject,
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from "@nestjs/common";
import { Observable, mergeMap } from "rxjs";
import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { DB, workspaceMembers, type Db } from "@userhq/db";
import {
  ANALYTICS_RECEIPT_HEADER,
  ANALYTICS_REQUEST_HEADER,
  AnalyticsReceiptSchema,
  type AnalyticsEvent,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { analyticsContext } from "./context.js";

export function telemetryId(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`analytics:v1:${value}`)
    .digest("hex")
    .slice(0, 32);
}

@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const events: AnalyticsEvent[] = [];
    const buffer = {
      events,
      scope: undefined as
        | { workspaceId?: string; productId?: string; role?: "owner" | "admin" }
        | undefined,
    };
    return new Observable((subscriber) =>
      analyticsContext.run(buffer, () => {
        const sub = next
          .handle()
          .pipe(
            mergeMap(async (data) => {
              const scope = req.tenant ?? req.portal;
              if (
                req.headers?.[ANALYTICS_REQUEST_HEADER] === "context" &&
                scope?.workspaceId
              ) {
                try {
                  res.setHeader(
                    "x-userhq-analytics-context",
                    Buffer.from(
                      JSON.stringify({
                        workspace_id: telemetryId(
                          scope.workspaceId,
                          this.env.BETTER_AUTH_SECRET,
                        ),
                        ...(scope.productId
                          ? {
                              product_id: telemetryId(
                                scope.productId,
                                this.env.BETTER_AUTH_SECRET,
                              ),
                            }
                          : {}),
                      }),
                    ).toString("base64url"),
                  );
                } catch {
                  /* optional SSR context */
                }
                return data;
              }
              // Only the first-party browser relay opts in; API keys and owner testing never relay.
              if (
                req.headers?.[ANALYTICS_REQUEST_HEADER] !== "1" ||
                req.apiKey ||
                !req.user?.id ||
                req.user.id.startsWith("integration:") ||
                isPlatformOwner(req.user, this.env.PLATFORM_OWNER_EMAIL) ||
                (req.headers?.origin &&
                  req.headers.origin !== this.env.PUBLIC_URL)
              )
                return data;
              try {
                if (!events.length) return data;
                const tenant = {
                  ...(req.tenant ?? req.portal),
                  ...buffer.scope,
                };
                let role: "customer" | "owner" | "admin" =
                  tenant.role ?? "customer";
                if (!req.tenant && tenant?.workspaceId) {
                  const [member] = await this.db
                    .select({ role: workspaceMembers.role })
                    .from(workspaceMembers)
                    .where(
                      and(
                        eq(workspaceMembers.workspaceId, tenant.workspaceId),
                        eq(workspaceMembers.userId, req.user.id),
                      ),
                    )
                    .limit(1);
                  if (member) role = member.role;
                }
                const receipt = AnalyticsReceiptSchema.parse({
                  id: randomUUID(),
                  events: events.map((e) => ({
                    name: e.name,
                    properties: {
                      ...e.properties,
                      actor_role: role,
                      ...(tenant?.workspaceId
                        ? {
                            workspace_id: telemetryId(
                              tenant.workspaceId,
                              this.env.BETTER_AUTH_SECRET,
                            ),
                          }
                        : {}),
                      ...(tenant?.productId
                        ? {
                            product_id: telemetryId(
                              tenant.productId,
                              this.env.BETTER_AUTH_SECRET,
                            ),
                          }
                        : {}),
                    },
                  })),
                });
                res.setHeader(
                  ANALYTICS_RECEIPT_HEADER,
                  Buffer.from(JSON.stringify(receipt)).toString("base64url"),
                );
                res.setHeader("Cache-Control", "no-store");
              } catch {
                /* DB or telemetry failure must not fail the already committed action. */
              }
              return data;
            }),
          )
          .subscribe(subscriber);
        return () => sub.unsubscribe();
      }),
    );
  }
}
