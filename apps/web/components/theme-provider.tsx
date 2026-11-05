"use client";

import * as React from "react";
import {
  applyThemeToDocument,
  getStoredThemePreference,
  resolveEffectiveTheme,
  saveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [theme, setThemeState] = React.useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  // Initialize theme from storage/document on client mount
  React.useEffect(() => {
    const stored = getStoredThemePreference();
    setThemeState(stored);
    const resolved = applyThemeToDocument(stored);
    setResolvedTheme(resolved);
  }, []);

  // Listen for system theme changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // If current preference is 'system', dynamically update the document and resolved state
      const currentStored = getStoredThemePreference();
      if (currentStored === "system") {
        const resolved = resolveEffectiveTheme("system", e.matches);
        applyThemeToDocument("system");
        setResolvedTheme(resolved);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const setTheme = React.useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    saveThemePreference(nextTheme);
    const resolved = applyThemeToDocument(nextTheme);
    setResolvedTheme(resolved);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    // Graceful fallback for SSR or components rendered outside provider
    return {
      theme: "system",
      setTheme: () => {},
      resolvedTheme: "light",
    };
  }
  return context;
}
