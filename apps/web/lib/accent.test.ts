import { describe, it, expect } from "vitest";
import { PALETTE, DEFAULT_ACCENT } from "@userhq/types";
import { accentTokens, accentStyle, contrastRatio } from "./accent.js";

describe("accentTokens & contrastRatio (Plan 02-08 Task 2)", () => {
  it("accentTokens('#2563EB') -> primaryForeground '#FFFFFF', primaryText '#2563EB'", () => {
    const tokens = accentTokens("#2563EB");
    expect(tokens).toEqual({
      primary: "#2563EB",
      primaryForeground: "#FFFFFF",
      primaryText: "#2563EB",
    });
  });

  it("accentTokens('#FACC15') -> primaryForeground '#000000', primaryText '#171717'", () => {
    const tokens = accentTokens("#FACC15");
    expect(tokens).toEqual({
      primary: "#FACC15",
      primaryForeground: "#000000",
      primaryText: "#171717",
    });
  });

  it("accentTokens('red;}') and accentTokens('#12345') -> tokens of DEFAULT_ACCENT", () => {
    const defaultExpected = accentTokens(DEFAULT_ACCENT);
    expect(accentTokens("red;}")).toEqual(defaultExpected);
    expect(accentTokens("#12345")).toEqual(defaultExpected);
  });

  it("accentTokens('#2563eb') -> primary '#2563EB' (uppercased)", () => {
    const tokens = accentTokens("#2563eb");
    expect(tokens.primary).toBe("#2563EB");
  });

  it("accentTokens with customFgHex overrides primaryForeground when valid", () => {
    const tokens = accentTokens("#2563EB", "#000000");
    expect(tokens.primaryForeground).toBe("#000000");

    const tokensLower = accentTokens("#2563EB", "#112233");
    expect(tokensLower.primaryForeground).toBe("#112233");
  });

  it("accentTokens with null or invalid customFgHex falls back to automatic contrast", () => {
    const tokensNull = accentTokens("#2563EB", null);
    expect(tokensNull.primaryForeground).toBe("#FFFFFF");

    const tokensInvalid = accentTokens("#2563EB", "not-a-hex");
    expect(tokensInvalid.primaryForeground).toBe("#FFFFFF");
  });

  it("accentStyle('#2563EB') includes --primary, --primary-foreground, --primary-text, --ring, and --entity-accent", () => {
    const style = accentStyle("#2563EB");
    expect(style).toEqual({
      "--primary": "#2563EB",
      "--primary-foreground": "#FFFFFF",
      "--primary-text": "#2563EB",
      "--ring": "#2563EB",
      "--entity-accent": "#2563EB",
    });
  });

  it("accentStyle supports customFgHex", () => {
    const style = accentStyle("#2563EB", "#112233");
    expect(style["--primary-foreground"]).toBe("#112233");
  });

  it("for every PALETTE hex, contrast(primaryForeground, primary) >= 4.5 and contrast(primaryText, #FFFFFF) >= 4.5", () => {
    for (const swatch of PALETTE) {
      const tokens = accentTokens(swatch.hex);
      const fgContrast = contrastRatio(tokens.primaryForeground, tokens.primary);
      const textContrast = contrastRatio(tokens.primaryText, "#FFFFFF");

      expect(
        fgContrast,
        `Swatch ${swatch.name} (${swatch.hex}) foreground contrast ${fgContrast} is below 4.5`
      ).toBeGreaterThanOrEqual(4.5);

      expect(
        textContrast,
        `Swatch ${swatch.name} (${swatch.hex}) text contrast ${textContrast} is below 4.5`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
