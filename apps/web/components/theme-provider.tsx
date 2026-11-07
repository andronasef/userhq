"use client";

import * as React from "react";
import {
  applyThemeToDocument,
  getDocumentThemePreference,
  reapplyDocumentTheme,
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

  // The head script already resolved storage into the document, so the document
  // is the source of truth. A layout effect corrects the state before first paint
  // (server and first client render keep the defaults, which hydration requires).
  React.useLayoutEffect(() => {
    const preference = getDocumentThemePreference();
    setThemeState(preference);
    setResolvedTheme(applyThemeToDocument(preference));
  }, []);

  // System follows OS scheme changes live; explicit light/dark re-apply to themselves.
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setResolvedTheme(reapplyDocumentTheme());

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
