"use client";

import * as React from "react";
import { authClient } from "../lib/auth-client";

const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
let lastRefreshTime = 0;

function refreshSession(): void {
  const now = Date.now();
  if (now - lastRefreshTime < THROTTLE_MS) return;

  lastRefreshTime = now;
  authClient.getSession().catch(() => {
    // Silently ignore network or refresh errors in keep-alive
  });
}

export function SessionKeepAlive(): null {
  React.useEffect(() => {
    // Refresh on mount
    refreshSession();

    // Refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
