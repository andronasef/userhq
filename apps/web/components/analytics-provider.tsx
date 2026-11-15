"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { MeResponse } from "@userhq/types";
import { partytownSnippet } from "@qwik.dev/partytown/integration";
import { GTM_CONTAINER_ID, CLARITY_PROJECT_ID } from "../lib/analytics-config";
import {
  configureAnalytics,
  consumeNotificationAttribution,
  track,
} from "../lib/analytics";
import { analyticsRoute } from "../lib/analytics-route";
import { installAnalyticsNavigationBoundary } from "../lib/analytics-navigation";
import { apiFetch } from "../lib/api-client";

export function AnalyticsProvider({
  enabled,
  me,
  opaqueId,
  release = "unversioned",
}: {
  enabled: boolean;
  me: MeResponse;
  opaqueId: string | null;
  release?: string;
}) {
  const pathname = usePathname();
  const initialized = useRef(false);
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (
      !enabled ||
      me.isPlatformOwner ||
      !analyticsRoute(window.location.pathname).track
    ) {
      configureAnalytics(false, me, null);
      return;
    }
    if (initialized.current) {
      configureAnalytics(true, me, opaqueId, release);
      return;
    }
    initialized.current = true;
    consumeNotificationAttribution();
    if (window.location.pathname === "/login") {
      const code = new URLSearchParams(window.location.search).get("error");
      if (code)
        track("auth_failed", {
          module: "auth",
          outcome:
            code === "access_denied"
              ? "cancelled"
              : /state|restart/.test(code)
                ? "expired"
                : /link_account|account_not_linked/.test(code)
                  ? "account_conflict"
                  : "provider_error",
        });
    }
    // Consumes a short-lived auth outcome cookie only for this authenticated browser.
    if (me.user) void apiFetch("/api/v1/me").catch(() => {});
    const workerScript = document.createElement("script");
    workerScript.type = "text/partytown";
    workerScript.textContent = `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});`;
    document.head.appendChild(workerScript);
    const gtm = document.createElement("script");
    gtm.type = "text/partytown";
    gtm.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`;
    document.head.appendChild(gtm);
    const boot = document.createElement("script");
    boot.textContent = partytownSnippet({
      forward: ["dataLayer.push"],
      fallbackTimeout: 0,
    });
    document.head.appendChild(boot);
    const current = analyticsRoute(window.location.pathname);
    // Clarity needs actual DOM observers; unlike GTM it is a recording instrument.
    // Avoid query/referrer secrets and content-derived slugs; keep index/form journeys.
    const safeReferrer =
      !document.referrer ||
      (() => {
        try {
          const r = new URL(document.referrer);
          return !r.search && !r.hash && analyticsRoute(r.pathname).record;
        } catch {
          return false;
        }
      })();
    if (
      current.record &&
      !current.route.includes(":ref") &&
      !window.location.search &&
      !window.location.hash &&
      safeReferrer
    ) {
      const w = window as unknown as {
        clarity: ((...args: unknown[]) => void) & { q?: unknown[][] };
      };
      w.clarity =
        w.clarity ||
        Object.assign(
          (...args: unknown[]) => {
            (w.clarity.q ??= []).push(args);
          },
          { q: [] },
        );
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
      document.head.appendChild(script);
    }
    const nr = document.createElement("script");
    nr.src = "/monitoring/newrelic-browser.js";
    nr.async = true;
    nr.onload = () => {
      try {
        const monitor = (
          window as unknown as {
            newrelic?: {
              addRelease?: (name: string, version: string) => void;
              setCurrentRouteName?: (route: string) => void;
            };
          }
        ).newrelic;
        monitor?.addRelease?.(
          "UserHQ",
          /^[A-Za-z0-9._-]{1,80}$/.test(release) ? release : "unversioned",
        );
        monitor?.setCurrentRouteName?.(
          analyticsRoute(window.location.pathname).route,
        );
      } catch {
        /* monitoring is optional */
      }
    };
    document.head.appendChild(nr);
    // Enable/flush first-party events only after the forwarding shim is installed.
    configureAnalytics(true, me, opaqueId, release);
  }, [enabled, me, opaqueId, release]);
  useEffect(
    () => (enabled ? installAnalyticsNavigationBoundary() : undefined),
    [enabled],
  );
  useEffect(() => {
    if (
      !enabled ||
      me.isPlatformOwner ||
      !pathname ||
      lastPath.current === pathname
    )
      return;
    lastPath.current = pathname;
    track("page_view");
    const route = analyticsRoute(pathname);
    if (route.surface === "portal")
      track(route.route.includes(":ref") ? "content_opened" : "portal_viewed");
  }, [enabled, pathname, me.isPlatformOwner]);
  return null;
}
