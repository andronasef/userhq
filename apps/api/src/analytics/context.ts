import { AsyncLocalStorage } from "node:async_hooks";
import {
  AnalyticsEventSchema,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@userhq/types";

/** Request-local only. Events are discarded if the handler/transaction throws. */
export interface RequestAnalytics {
  events: Array<ReturnType<typeof AnalyticsEventSchema.parse>>;
  scope?: {
    workspaceId?: string;
    productId?: string;
    role?: "owner" | "admin";
  };
}
export const analyticsContext = new AsyncLocalStorage<RequestAnalytics>();
export function recordScope(
  scope: NonNullable<RequestAnalytics["scope"]>,
): void {
  const context = analyticsContext.getStore();
  if (context) context.scope = { ...context.scope, ...scope };
}
export function recordOutcome(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  try {
    const ctx = analyticsContext.getStore();
    if (ctx && ctx.events.length < 8)
      ctx.events.push(AnalyticsEventSchema.parse({ name, properties }));
  } catch {
    /* Telemetry cannot affect a business operation. */
  }
}
