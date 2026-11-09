"use client";

import * as React from "react";

export interface PortalBadgeAttributionProps {
  ws: string;
  product: string;
}

export function PortalBadgeAttribution({
  ws,
  product,
}: PortalBadgeAttributionProps): null {
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.location.search) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;

    // Check if there are any search params to evaluate
    const paramsRecord: Record<string, string> = {};
    const keysToDelete: string[] = [];

    searchParams.forEach((value, key) => {
      paramsRecord[key] = value;
      // Mark potential signature or attribution keys for scrubbing
      if (
        key.endsWith("_sig") ||
        key === "signature" ||
        key === "sig" ||
        key === "tier" ||
        key === "plan" ||
        key === "badge" ||
        key === "attr"
      ) {
        keysToDelete.push(key);
      }
    });

    if (Object.keys(paramsRecord).length === 0) {
      return;
    }

    // Call API to evaluate attribution and set cookie / auto-bind badge
    fetch(`/api/portal/${ws}/${product}/badges/attribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchParams: paramsRecord }),
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        // If matched badges were found or keys were marked, scrub sensitive params from URL bar
        if (data?.matchedBadges?.length > 0 || keysToDelete.length > 0) {
          keysToDelete.forEach((k) => searchParams.delete(k));
          const newRelativePathQuery =
            currentUrl.pathname +
            (searchParams.toString() ? `?${searchParams.toString()}` : "") +
            currentUrl.hash;
          window.history.replaceState(null, "", newRelativePathQuery);
        }
      })
      .catch(() => {
        // Silent failure: never break visitor portal experience
      });
  }, [ws, product]);

  return null;
}
