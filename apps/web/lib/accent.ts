import { DEFAULT_ACCENT, HEX_COLOR_RE } from "@userhq/types";

function channelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const rLinear = channelToLinear(r);
  const gLinear = channelToLinear(g);
  const bLinear = channelToLinear(b);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lMax = Math.max(l1, l2);
  const lMin = Math.min(l1, l2);
  return (lMax + 0.05) / (lMin + 0.05);
}

// Page, card and muted surfaces per theme. accent.test.ts checks these against globals.css.
export const ACCENT_SURFACES = {
  light: { background: "#F6F8F7", card: "#FFFFFF", muted: "#EAF0ED" },
  dark: { background: "#0B111E", card: "#131D2E", muted: "#1A2638" },
  charcoal: { background: "#0D0D12", card: "#151519", muted: "#202025" },
} as const;

const MIN_TEXT_CONTRAST = 4.5;

function meetsOn(
  hex: string,
  surfaces: readonly string[]
): boolean {
  return surfaces.every((surface) => contrastRatio(hex, surface) >= MIN_TEXT_CONTRAST);
}

function tintedSurfaces(brand: string, surfaces: Record<string, string>): string[] {
  const base = Object.values(surfaces);
  return [...base, ...base.map((surface) => `#${[1, 3, 5].map((at) => {
    const ink = parseInt(brand.slice(at, at + 2), 16);
    const background = parseInt(surface.slice(at, at + 2), 16);
    return Math.round(ink * 0.2 + background * 0.8).toString(16).padStart(2, "0");
  }).join("")}`)];
}

// Mix `hex` toward white by `amount` (0..1), uppercase #RRGGBB.
function mixWithWhite(hex: string, amount: number): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

function mixWithBlack(hex: string, amount: number): string {
  return `#${[1, 3, 5].map((at) => Math.round(parseInt(hex.slice(at, at + 2), 16) * (1 - amount))
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export interface AccentTokens {
  primary: string;
  primaryForeground: string;
  /** Accent text on light surfaces. */
  primaryText: string;
  /** Accent text on dark surfaces: the brand lightened until it reads. */
  primaryTextDark: string;
}

export function accentTokens(
  hex: string,
  customFgHex?: string | null
): AccentTokens {
  if (!hex || !HEX_COLOR_RE.test(hex)) {
    return accentTokens(DEFAULT_ACCENT, customFgHex);
  }

  const primary = hex.toUpperCase();
  const vsWhite = contrastRatio("#FFFFFF", primary);
  const vsBlack = contrastRatio("#000000", primary);

  let primaryForeground: string;
  if (customFgHex && HEX_COLOR_RE.test(customFgHex)) {
    primaryForeground = customFgHex.toUpperCase();
  } else {
    primaryForeground = vsWhite >= vsBlack ? "#FFFFFF" : "#000000";
  }

  const lightSurfaces = tintedSurfaces(primary, ACCENT_SURFACES.light);
  // Navy Dark and Charcoal share the dark color-scheme token, so it must read on both palettes.
  const darkSurfaces = [
    ...tintedSurfaces(primary, ACCENT_SURFACES.dark),
    ...tintedSurfaces(primary, ACCENT_SURFACES.charcoal),
  ];
  // Keep the established fallback for brands that already fail on page/card. Otherwise retain the hue.
  let primaryText = meetsOn(primary, [ACCENT_SURFACES.light.background, ACCENT_SURFACES.light.card]) ? primary : "#171717";
  for (let step = 1; !meetsOn(primaryText, lightSurfaces); step++) {
    primaryText = mixWithBlack(primary, step * 0.05);
  }

  // White always meets 4.5:1 on the dark surfaces, so the loop terminates.
  let primaryTextDark = primary;
  for (let step = 1; !meetsOn(primaryTextDark, darkSurfaces); step++) {
    primaryTextDark = mixWithWhite(primary, step * 0.05);
  }

  return {
    primary,
    primaryForeground,
    primaryText,
    primaryTextDark,
  };
}

export function accentStyle(
  hex: string,
  customFgHex?: string | null
): Record<string, string> {
  const tokens = accentTokens(hex, customFgHex);
  return {
    "--primary": tokens.primary,
    "--primary-foreground": tokens.primaryForeground,
    // light-dark() follows the element's used color-scheme, which the theme
    // script and applyThemeToDocument set on <html>.
    "--primary-text": `light-dark(${tokens.primaryText}, ${tokens.primaryTextDark})`,
    "--ring": `light-dark(${tokens.primaryText}, ${tokens.primaryTextDark})`,
    "--entity-accent": tokens.primary,
  };
}
