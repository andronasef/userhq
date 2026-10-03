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

export interface AccentTokens {
  primary: string;
  primaryForeground: "#FFFFFF" | "#000000";
  primaryText: string;
}

export function accentTokens(hex: string): AccentTokens {
  if (!hex || !HEX_COLOR_RE.test(hex)) {
    return accentTokens(DEFAULT_ACCENT);
  }

  const primary = hex.toUpperCase();
  const vsWhite = contrastRatio("#FFFFFF", primary);
  const vsBlack = contrastRatio("#000000", primary);

  const primaryForeground: "#FFFFFF" | "#000000" =
    vsWhite >= vsBlack ? "#FFFFFF" : "#000000";

  const primaryText = vsWhite >= 4.5 ? primary : "#171717";

  return {
    primary,
    primaryForeground,
    primaryText,
  };
}
