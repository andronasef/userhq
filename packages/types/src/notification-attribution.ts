import type { AnalyticsProperties } from "./analytics.js";

/** Mark a first-party notification destination without recipient or credential data. */
export function notificationDestination(
  path: string,
  channel: NonNullable<AnalyticsProperties["channel"]>,
  type: NonNullable<AnalyticsProperties["notification_type"]>,
): string {
  try {
    const absolute = /^https?:\/\//.test(path);
    const url = new URL(path, "https://userhq.invalid");
    if (/\/(unsubscribe|mute|invite|api)(\/|$)/.test(url.pathname)) return path;
    url.searchParams.set("uhq_channel", channel);
    url.searchParams.set("uhq_type", type);
    return absolute ? url.href : url.pathname + url.search + url.hash;
  } catch {
    return path;
  }
}
