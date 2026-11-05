import { describe, expect, it } from "vitest";
import {
  isThemePreference,
  resolveEffectiveTheme,
  THEME_PREFERENCES,
} from "../lib/theme";

describe("Theme resolution logic", () => {
  it("recognizes valid theme preferences", () => {
    for (const theme of THEME_PREFERENCES) {
      expect(isThemePreference(theme)).toBe(true);
    }
    expect(isThemePreference("invalid")).toBe(false);
    expect(isThemePreference("")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("resolves dark preference to dark regardless of system", () => {
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
    expect(resolveEffectiveTheme("dark", true)).toBe("dark");
  });

  it("resolves light preference to light regardless of system", () => {
    expect(resolveEffectiveTheme("light", false)).toBe("light");
    expect(resolveEffectiveTheme("light", true)).toBe("light");
  });

  it("resolves system preference based on systemPrefersDark", () => {
    expect(resolveEffectiveTheme("system", false)).toBe("light");
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
  });
});
