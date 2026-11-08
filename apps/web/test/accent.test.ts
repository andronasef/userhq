import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, HEX_COLOR_RE } from "@userhq/types";
import {
  ACCENT_SURFACES,
  accentStyle,
  accentTokens,
  contrastRatio,
} from "../lib/accent";

const BRANDS = [
  "#FFFFFF",
  "#FDE047",
  "#FACC15",
  "#14B8A6",
  "#EF4444",
  "#2563EB",
  "#087F75",
  "#7C3AED",
  "#0000FF",
  "#1E3A8A",
  "#808080",
  "#000000",
];

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  return css.slice(start, css.indexOf("}", start));
}

function token(blockSource: string, name: string): string {
  const m = blockSource.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`no ${name} in block`);
  return m[1].toUpperCase();
}

const palette = {
  light: {
    background: token(block(":root"), "--background"),
    card: token(block(":root"), "--card"),
    muted: token(block(":root"), "--muted"),
  },
  dark: {
    background: token(block(".dark"), "--background"),
    card: token(block(".dark"), "--card"),
    muted: token(block(".dark"), "--muted"),
  },
  charcoal: {
    background: token(block(".charcoal"), "--background"),
    card: token(block(".charcoal"), "--card"),
    muted: token(block(".charcoal"), "--muted"),
  },
};

describe("accent tokens: text on the accent", () => {
  // Theme-independent: both themes use the same inline --primary-foreground override.
  it.each(BRANDS)("auto foreground on %s is at least 4.5:1", (brand) => {
    const t = accentTokens(brand);
    expect(contrastRatio(t.primaryForeground, t.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("accent tokens: accent text on page surfaces", () => {
  const tint = (brand: string, surface: string): string => `#${[1, 3, 5].map((at) => {
    const ink = Number.parseInt(brand.slice(at, at + 2), 16);
    const background = Number.parseInt(surface.slice(at, at + 2), 16);
    return Math.round(ink * 0.2 + background * 0.8).toString(16).padStart(2, "0");
  }).join("")}`;

  it.each(BRANDS)("%s reads at 4.5:1 on all three surfaces and their 20 percent accent tints in every theme", (brand) => {
    const tokens = accentTokens(brand);
    for (const theme of ["light", "dark", "charcoal"] as const) {
      const text = theme === "light" ? tokens.primaryText : tokens.primaryTextDark;
      for (const surface of Object.values(palette[theme])) {
        expect(contrastRatio(text, surface), `${brand} ${theme} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, tint(brand, surface)), `${brand} ${theme} on tinted ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it.each(BRANDS)("light value for %s is at least 4.5:1 on both light surfaces", (brand) => {
    const t = accentTokens(brand);
    expect(contrastRatio(t.primaryText, palette.light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.primaryText, palette.light.card)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BRANDS)("dark value for %s is hex and at least 4.5:1 on both dark surfaces", (brand) => {
    const t = accentTokens(brand);
    expect(t.primaryTextDark).toMatch(HEX_COLOR_RE);
    expect(contrastRatio(t.primaryTextDark, palette.dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.primaryTextDark, palette.dark.card)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the brand in dark when already readable", () => {
    expect(accentTokens("#FACC15").primaryTextDark).toBe("#FACC15");
  });

  it.each(["#1E3A8A", "#2563EB", "#000000", "#14B8A6"])("lightens %s in dark", (brand) => {
    const t = accentTokens(brand);
    expect(t.primaryTextDark).not.toBe(brand);
    expect(contrastRatio(t.primaryTextDark, "#000000")).toBeGreaterThan(
      contrastRatio(brand, "#000000")
    );
  });

  it("keeps readable hues and preserves the existing fallback on light surfaces", () => {
    // Worked 20%-tint example: #1F54C8 reaches only 4.417:1 on tinted muted; #1E4FBC reaches 4.814:1.
    expect(accentTokens("#2563EB").primaryText).toBe("#1E4FBC");
    expect(accentTokens("#087F75").primaryText).toMatch(/^#0[0-9A-F][0-9A-F]{4}$/);
    expect(accentTokens("#FACC15").primaryText).toBe("#171717");
    expect(accentTokens("#FFFFFF").primaryText).toBe("#171717");
  });

  it("falls back to the default accent for invalid or empty input", () => {
    const def = accentTokens(DEFAULT_ACCENT);
    for (const bad of ["", "nope", "#12"]) {
      expect(accentTokens(bad)).toEqual(def);
    }
    expect(def.primaryTextDark).toMatch(HEX_COLOR_RE);
  });
});

describe("accentStyle", () => {
  it("emits --primary-text as a light-dark pair and keeps the other keys", () => {
    const t = accentTokens("#2563EB");
    const s = accentStyle("#2563EB");
    expect(s["--primary-text"]).toBe(`light-dark(${t.primaryText}, ${t.primaryTextDark})`);
    expect(s["--primary"]).toBe(t.primary);
    expect(s["--primary-foreground"]).toBe(t.primaryForeground);
    expect(s["--ring"]).toBe(s["--primary-text"]);
    expect(s["--entity-accent"]).toBe(t.primary);
  });
});

describe("static theme text and focus tokens", () => {
  it.each(["light", "dark", "charcoal"] as const)("%s text clears 4.5:1 on page, card and muted, and focus uses the readable accent", (theme) => {
    const source = block(theme === "light" ? ":root" : `.${theme}`);
    for (const name of ["--muted-foreground", "--foreground", "--primary-text"]) {
      for (const surface of Object.values(palette[theme])) {
        expect(contrastRatio(token(source, name), surface), `${theme} ${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(token(source, "--ring")).toBe(token(source, "--primary-text"));
  });
});

describe("ACCENT_SURFACES drift guard", () => {
  it("matches --background, --card and --muted in globals.css", () => {
    const norm = (s: { background: string; card: string; muted: string }) => ({
      background: s.background.toUpperCase(),
      card: s.card.toUpperCase(),
      muted: s.muted.toUpperCase(),
    });
    expect(norm(ACCENT_SURFACES.light)).toEqual(palette.light);
    expect(norm(ACCENT_SURFACES.dark)).toEqual(palette.dark);
    expect(norm(ACCENT_SURFACES.charcoal)).toEqual(palette.charcoal);
  });
});

describe("accent tokens: brand text on charcoal surfaces", () => {
  it.each(BRANDS)("primaryTextDark clears 4.5:1 on charcoal page, card and muted for %s", (brand) => {
    const t = accentTokens(brand);
    for (const surface of Object.values(ACCENT_SURFACES.charcoal)) {
      expect(contrastRatio(t.primaryTextDark, surface), `primaryTextDark on charcoal ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
