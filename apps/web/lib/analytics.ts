import {
  AnalyticsEventSchema,
  AnalyticsPropertiesSchema,
  AnalyticsReceiptSchema,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type MeResponse,
} from "@userhq/types";
import { analyticsRoute } from "./analytics-route";

type TelemetryWindow = Window & {
  dataLayer?: unknown[];
  clarity?: (...args: unknown[]) => void;
  newrelic?: {
    noticeError?: (e: Error, attrs?: Record<string, string>) => void;
    setCustomAttribute?: (key: string, value: string | null) => void;
  };
  __userhqAnalytics?: boolean;
};
let ready = false;
let identity: string | null = null;
let me: MeResponse | null = null;
let release = "unversioned";
const receipts = new Set<string>();
const pending: Array<{
  name: AnalyticsEventName;
  properties: AnalyticsProperties;
}> = [];
let attribution: Pick<AnalyticsProperties, "channel" | "notification_type"> =
  {};

function browser(): TelemetryWindow | null {
  return typeof window === "undefined" ? null : (window as TelemetryWindow);
}
export function configureAnalytics(
  enabled: boolean,
  currentMe: MeResponse,
  opaqueId: string | null,
  appRelease = "unversioned",
): void {
  const w = browser();
  me = currentMe;
  release = /^[A-Za-z0-9._-]{1,80}$/.test(appRelease)
    ? appRelease
    : "unversioned";
  ready = enabled && !currentMe.isPlatformOwner;
  if (w) w.__userhqAnalytics = ready;
  identity = ready ? opaqueId : null;
  if (!ready) {
    pending.length = 0;
    return;
  }
  const buffered = pending.splice(0);
  for (const event of buffered) track(event.name, event.properties);
}
export function clearAnalyticsIdentity(): void {
  identity = null;
  try {
    browser()?.dataLayer?.push({ event: "userhq_identity", user_id: null });
  } catch {
    /* optional */
  }
}
export function track(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  try {
    const w = browser();
    if (!w) return;
    if (!ready) {
      if (!me && pending.length < 30) pending.push({ name, properties });
      return;
    }
    const route = analyticsRoute(w.location.pathname);
    if (!route.track) return;
    const ws =
      route.surface === "dashboard"
        ? w.location.pathname.split("/")[2]
        : w.location.pathname.split("/")[1];
    const role =
      me?.workspaces.find((item) => item.slug === ws)?.role ??
      (me?.user ? "customer" : "visitor");
    const scope =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(
            "[data-userhq-analytics-workspace]",
          )
        : null;
    const ids = {
      ...(scope?.dataset.userhqAnalyticsWorkspace
        ? { workspace_id: scope.dataset.userhqAnalyticsWorkspace }
        : {}),
      ...(scope?.dataset.userhqAnalyticsProduct
        ? { product_id: scope.dataset.userhqAnalyticsProduct }
        : {}),
    };
    const event = AnalyticsEventSchema.parse({
      name,
      properties: {
        environment: "production",
        release,
        actor_role: role,
        surface: route.surface,
        module: route.module,
        route: route.route,
        ...ids,
        ...attribution,
        ...properties,
      },
    });
    w.dataLayer ??= [];
    w.dataLayer.push({
      ...Object.fromEntries(
        Object.keys(AnalyticsPropertiesSchema.shape).map((key) => [key, null]),
      ),
      event: "userhq_event",
      event_name: event.name,
      user_id: identity,
      ...event.properties,
      page_location: w.location.origin + route.route,
      page_title: "UserHQ " + (route.module ?? route.surface),
      page_referrer: "",
    });
    if (route.record) w.clarity?.("event", name);
    if (["vote_added", "comment_created", "feedback_created"].includes(name))
      completePendingAction(
        event.properties.action ??
          (name === "vote_added"
            ? "vote"
            : name === "comment_created"
              ? "comment"
              : "feedback"),
      );
  } catch {
    /* Missing/blocked/throwing vendors must never alter product behavior. */
  }
}
export function relayAnalyticsReceipt(value: string | null): void {
  try {
    if (!value || value.length > 12000) return;
    const receipt = AnalyticsReceiptSchema.parse(
      JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/"))),
    );
    if (receipts.has(receipt.id)) return;
    if (receipts.size >= 500) receipts.clear();
    receipts.add(receipt.id);
    for (const event of receipt.events) track(event.name, event.properties);
  } catch {
    /* A malformed telemetry header cannot break an API response. */
  }
}
export function startContribution(
  action: "vote" | "comment" | "feedback",
  requiresSignIn = false,
): void {
  track("contribution_started", { action });
  if (requiresSignIn) {
    track("sign_in_required", { action });
    try {
      sessionStorage.setItem(
        "userhq_analytics_intent",
        JSON.stringify({
          action,
          scope: window.location.pathname.split("/").slice(1, 3).join("/"),
          time: Date.now(),
        }),
      );
    } catch {
      /* optional */
    }
  }
}
function completePendingAction(action: string): void {
  try {
    const raw = sessionStorage.getItem("userhq_analytics_intent");
    if (!raw) return;
    const p = JSON.parse(raw);
    if (
      p.action === action &&
      p.scope === window.location.pathname.split("/").slice(1, 3).join("/") &&
      Number.isFinite(p.time) &&
      Date.now() - p.time >= 0 &&
      Date.now() - p.time < 1800000
    ) {
      sessionStorage.removeItem("userhq_analytics_intent");
      track("post_auth_action_completed", {
        action: action as "vote" | "comment" | "feedback",
        duration_ms: Date.now() - p.time,
        resumed: true,
      });
    }
  } catch {
    /* optional */
  }
}
export function consumeNotificationAttribution(): void {
  try {
    const w = browser();
    if (!w) return;
    const url = new URL(w.location.href);
    const channel = url.searchParams.get("uhq_channel");
    const type = url.searchParams.get("uhq_type");
    const event = AnalyticsEventSchema.safeParse({
      name: "notification_link_opened",
      properties: { channel, notification_type: type },
    });
    if (event.success) attribution = event.data.properties;
    if (
      url.searchParams.has("uhq_channel") ||
      url.searchParams.has("uhq_type")
    ) {
      url.searchParams.delete("uhq_channel");
      url.searchParams.delete("uhq_type");
      w.history.replaceState(
        w.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    if (event.success) track(event.data.name, event.data.properties);
  } catch {
    /* optional */
  }
}
export function reportBrowserError(
  outcome: "server_error" | "network" | "unknown",
): void {
  try {
    browser()?.newrelic?.noticeError?.(new Error(`UserHQ ${outcome}`), {
      error_code: outcome,
    });
  } catch {
    /* optional */
  }
}
