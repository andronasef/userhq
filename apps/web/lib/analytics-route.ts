export interface AnalyticsRoute {
  route: string;
  surface: "marketing" | "portal" | "dashboard" | "auth" | "account" | "guide";
  module?:
    | "board"
    | "roadmap"
    | "changelog"
    | "faq"
    | "workspace"
    | "settings"
    | "team"
    | "auth"
    | "account";
  record: boolean;
  track: boolean;
}

export function analyticsRoute(path: string): AnalyticsRoute {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const none: AnalyticsRoute = {
    route: "/excluded",
    surface: "marketing",
    record: false,
    track: false,
  };
  if (pathname === "/")
    return { route: "/", surface: "marketing", record: true, track: true };
  if (pathname === "/login")
    return {
      route: "/login",
      surface: "auth",
      module: "auth",
      record: false,
      track: true,
    };
  if (pathname === "/account")
    return {
      route: "/account",
      surface: "account",
      module: "account",
      record: false,
      track: true,
    };
  if (pathname === "/guide")
    return { route: "/guide", surface: "guide", record: false, track: true };
  const p = pathname.split("/").slice(1);
  if (p[0] === "dashboard") {
    if (p.length === 1)
      return {
        route: "/dashboard",
        surface: "dashboard",
        module: "workspace",
        track: true,
        record: false,
      };
    if (p.length === 2)
      return {
        route: "/dashboard/:ws",
        surface: "dashboard",
        module: "workspace",
        track: true,
        record: false,
      };
    if (p.length === 3 && ["team", "settings", "products"].includes(p[2]))
      return {
        route: `/dashboard/:ws/${p[2]}`,
        surface: "dashboard",
        module: p[2] === "team" ? "team" : "settings",
        track: true,
        record: false,
      };
    if (
      p.length >= 4 &&
      [
        "board",
        "roadmap",
        "changelog",
        "faq",
        "settings",
        "users",
        "categories",
        "statuses",
      ].includes(p[3])
    ) {
      const module = ["board", "roadmap", "changelog", "faq"].includes(p[3])
        ? (p[3] as "board" | "roadmap" | "changelog" | "faq")
        : "settings";
      return {
        route: `/dashboard/:ws/:product/${p[3]}${p.length > 4 ? "/:item" : ""}`,
        surface: "dashboard",
        module,
        track: true,
        record: false,
      };
    }
    return none;
  }
  if (
    [
      "platform",
      "api",
      "dev",
      "invite",
      "unsubscribe",
      "uploads",
      "privacy",
      "terms",
      "docs",
      "help",
      "~partytown",
    ].includes(p[0])
  )
    return none;
  if (!p.every((part) => /^[a-zA-Z0-9_-]+$/.test(part))) return none;
  if (p.length === 1)
    return {
      route: "/:ws",
      surface: "portal",
      module: "workspace",
      record: true,
      track: true,
    };
  if (p.length === 2)
    return {
      route: "/:ws/:product",
      surface: "portal",
      module: "board",
      record: true,
      track: true,
    };
  if (p.length === 3 && ["roadmap", "changelog", "faq"].includes(p[2]))
    return {
      route: `/:ws/:product/${p[2]}`,
      surface: "portal",
      module: p[2] as "roadmap" | "changelog" | "faq",
      record: true,
      track: true,
    };
  if (p.length === 3 && p[2] === "activity")
    return {
      route: "/:ws/:product/activity",
      surface: "portal",
      record: false,
      track: true,
    };
  if (p.length === 4 && ["p", "changelog"].includes(p[2]))
    return {
      route: `/:ws/:product/${p[2]}/:ref`,
      surface: "portal",
      module: p[2] === "p" ? "board" : "changelog",
      record: true,
      track: true,
    };
  return none;
}
