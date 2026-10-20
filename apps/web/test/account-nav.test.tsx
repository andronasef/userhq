import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountBackButton } from "../app/(app)/account/back-button";
import { HeaderBrand } from "../components/header-brand";
import { safeNext } from "../lib/safe-next";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => "/account",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Account Navigation & Back Button", () => {
  it("renders a link to the portal when initialBack is a valid portal path", () => {
    const html = renderToStaticMarkup(
      <AccountBackButton initialBack="/increasing-labs/core" />
    );

    expect(html).toContain('href="/increasing-labs/core"');
    expect(html).toContain("Back to portal");
  });

  it("renders a link to the dashboard when initialBack is a dashboard path", () => {
    const html = renderToStaticMarkup(
      <AccountBackButton initialBack="/dashboard/increasing-labs/core/board" />
    );

    expect(html).toContain('href="/dashboard/increasing-labs/core/board"');
    expect(html).toContain("Back to dashboard");
  });

  it("sanitizes malicious back urls using safeNext", () => {
    const malicious = "https://evil.com/phishing";
    const sanitized = safeNext(malicious, "");
    expect(sanitized).toBe("");

    const html = renderToStaticMarkup(
      <AccountBackButton initialBack={malicious} />
    );

    expect(html).not.toContain("evil.com");
  });

  it("renders generic Back button when initialBack is omitted", () => {
    const html = renderToStaticMarkup(<AccountBackButton />);
    expect(html).toContain("Back");
  });

  it("renders UserHQ brand on SSR in HeaderBrand", () => {
    const html = renderToStaticMarkup(<HeaderBrand />);
    expect(html).toContain("UserHQ");
    expect(html).toContain('href="/"');
  });
});
