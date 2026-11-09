import * as React from "react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/acme/widget" }));
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeToggle } from "../components/theme-toggle";
import { ThemeProvider } from "../components/theme-provider";

import { PortalFrame } from "../components/portal/portal-frame";

describe("ThemeToggle component", () => {
  it("renders dropdown variant with aria-label", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeToggle variant="dropdown" />
      </ThemeProvider>
    );

    expect(html).toContain("aria-label=");
    expect(html).toContain("Theme:");
  });

  it("renders segmented variant with radiogroup and options", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeToggle variant="segmented" />
      </ThemeProvider>
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Appearance preference"');
    expect(html).toContain("System");
    expect(html).toContain("Light");
    expect(html).toContain("Dark");
    expect(html).toContain("Charcoal");
    expect(html).toContain('role="radio"');
  });

  it("renders dropdown theme toggle in portal header and segmented toggle in footer", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <PortalFrame homeHref="/acme/widget" name="Widget">
          <div>Portal Body</div>
        </PortalFrame>
      </ThemeProvider>
    );

    // Header has the dropdown theme toggle icon button
    expect(html).toContain("Theme: System");
    // Footer has the segmented control
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Charcoal");
  });
});
