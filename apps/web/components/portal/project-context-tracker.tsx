"use client";

import * as React from "react";

export interface ProjectContextTrackerProps {
  name: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  wsName?: string;
  href: string;
}

export function ProjectContextTracker({
  name,
  logoUrl,
  accentColor,
  wsName,
  href,
}: ProjectContextTrackerProps): null {
  React.useEffect(() => {
    try {
      const data = { name, logoUrl, accentColor, wsName, href };
      sessionStorage.setItem("userhq_active_project", JSON.stringify(data));
      sessionStorage.setItem("userhq_last_return", href);
    } catch {
      // Ignore storage errors
    }
  }, [name, logoUrl, accentColor, wsName, href]);

  return null;
}
