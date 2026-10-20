"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { isPortalSectionChange } from "../../lib/portal-motion";

/** An entrance after a pointer-led section commit; routing stays entirely native. */
export function PortalSectionMotion({
  basePath,
  children,
}: {
  basePath: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const content = React.useRef<HTMLDivElement>(null);
  const previous = React.useRef(pathname);
  const intent = React.useRef<{ from: string; to: string; at: number } | null>(
    null,
  );
  const animation = React.useRef<Animation | null>(null);

  React.useEffect(() => {
    const clearIntent = () => {
      intent.current = null;
    };
    const onClick = (event: MouseEvent) => {
      clearIntent();
      if (
        event.defaultPrevented ||
        event.detail === 0 ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      const tabs = anchor?.closest("[data-portal-section-tabs]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        tabs?.getAttribute("data-portal-section-tabs") !== basePath ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      )
        return;
      const target = new URL(anchor.href);
      if (
        target.origin !== location.origin ||
        !isPortalSectionChange(pathname, target.pathname, basePath)
      )
        return;
      animation.current?.cancel();
      intent.current = {
        from: pathname,
        to: target.pathname,
        at: performance.now(),
      };
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", clearIntent, true);
    window.addEventListener("popstate", clearIntent);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", clearIntent, true);
      window.removeEventListener("popstate", clearIntent);
    };
  }, [basePath, pathname]);

  React.useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    const requested = intent.current;
    intent.current = null;
    animation.current?.cancel();
    const element = content.current;
    if (
      !element ||
      typeof element.animate !== "function" ||
      !requested ||
      requested.from !== from ||
      requested.to !== pathname ||
      performance.now() - requested.at > 10_000 ||
      !isPortalSectionChange(from, pathname, basePath)
    )
      return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const easing =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ease-out")
        .trim() || "cubic-bezier(0.23, 1, 0.32, 1)";
    animation.current = element.animate(
      [{ opacity: reduced ? 0.97 : 0.82 }, { opacity: 1 }],
      { duration: reduced ? 60 : 140, easing },
    );
    return () => animation.current?.cancel();
  }, [basePath, pathname]);

  return (
    <div
      ref={content}
      className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12"
    >
      {children}
    </div>
  );
}
