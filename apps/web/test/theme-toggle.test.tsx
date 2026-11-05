import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeToggle } from "../components/theme-toggle";
import { ThemeProvider } from "../components/theme-provider";

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
    expect(html).toContain('role="radio"');
  });
});
