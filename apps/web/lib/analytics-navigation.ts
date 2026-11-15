import { useRouter as useNextRouter } from "next/navigation";
import { analyticsRoute } from "./analytics-route";
import { track } from "./analytics";

/** Recorder lifetime is a document lifetime. Never SPA-render a private screen in it. */
export function needsDocumentNavigation(from: string, to: string): boolean {
  // Each recorded public screen gets a fresh document; no private DOM or search URL
  // may appear later inside the recorder's existing observer lifetime.
  return (
    analyticsRoute(from).record !== analyticsRoute(to).record ||
    (analyticsRoute(from).record && from !== to)
  );
}
export function installAnalyticsNavigationBoundary(): () => void {
  const from = window.location.pathname;
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  const guardedHistory = (original: typeof originalPush) =>
    function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      if (url && analyticsRoute(from).record) {
        const target = new URL(url, window.location.href);
        if (
          target.pathname !== window.location.pathname ||
          target.search !== window.location.search
        ) {
          window.location.assign(target.href);
          return;
        }
      }
      original.call(this, data, unused, url);
    };
  window.history.pushState = guardedHistory(originalPush);
  window.history.replaceState = guardedHistory(originalReplace);
  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element)?.closest?.("a");
    if (
      !anchor ||
      (anchor.target && anchor.target !== "_self") ||
      anchor.hasAttribute("download")
    )
      return;
    const url = new URL(anchor.href, window.location.origin);
    if (
      new URLSearchParams(window.location.search).has("q") &&
      analyticsRoute(url.pathname).route === "/:ws/:product/p/:ref"
    ) {
      track("search_result_opened", { module: "board" });
    }
    if (
      url.origin === window.location.origin &&
      needsDocumentNavigation(from, url.pathname + url.search)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(url.href);
    }
  };
  const pop = (event: PopStateEvent) => {
    if (needsDocumentNavigation(from, window.location.pathname)) {
      event.stopImmediatePropagation();
      window.location.reload();
    }
  };
  window.addEventListener("click", click, true);
  window.addEventListener("popstate", pop, true);
  return () => {
    window.removeEventListener("click", click, true);
    window.removeEventListener("popstate", pop, true);
    window.history.pushState = originalPush;
    window.history.replaceState = originalReplace;
  };
}
export function useAnalyticsRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  return {
    ...router,
    push(href, options) {
      if (
        typeof window !== "undefined" &&
        needsDocumentNavigation(window.location.pathname, href)
      )
        window.location.assign(href);
      else router.push(href, options);
    },
    replace(href, options) {
      if (
        typeof window !== "undefined" &&
        needsDocumentNavigation(window.location.pathname, href)
      )
        window.location.replace(href);
      else router.replace(href, options);
    },
  };
}
