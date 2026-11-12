export interface AnalyticsRoute {
  route: string;
  surface: "marketing" | "portal" | "dashboard" | "auth" | "account" | "guide";
  module?: "board" | "roadmap" | "changelog" | "faq" | "workspace" | "settings" | "team" | "auth" | "account";
  record: boolean;
  track: boolean;
}

export function analyticsRoute(_path: string): AnalyticsRoute {
  return { route: "/", surface: "marketing", record: false, track: false };
}
