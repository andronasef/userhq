"use client";

import * as React from "react";

export interface ProjectContextTrackerProps {
  name: string;
  wsName?: string;
  href: string;
}

export function ProjectContextTracker({
  name,
  wsName,
  href,
}: ProjectContextTrackerProps): null {
  React.useEffect(() => {
    try {
      sessionStorage.setItem(
        "userhq_active_project",
        JSON.stringify({ name, wsName, href })
      );
      sessionStorage.setItem("userhq_last_return", href);
    } catch {
      // Ignore storage errors
    }
  }, [name, wsName, href]);

  return null;
}
