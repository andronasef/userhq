export const USERHQ_THEME_STORAGE_KEY = "userhq_theme";
export const USERHQ_THEME_COOKIE_NAME = "userhq_theme";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const local = window.localStorage.getItem(USERHQ_THEME_STORAGE_KEY);
    if (isThemePreference(local)) {
      return local;
    }

    const match = document.cookie.match(
      new RegExp(`(?:^|; )${USERHQ_THEME_COOKIE_NAME}=([^;]*)`)
    );
    if (match && isThemePreference(match[1])) {
      return match[1];
    }
  } catch {
    // Ignore sandbox or security errors (e.g. disabled cookies/localStorage)
  }

  return "system";
}

export function saveThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(USERHQ_THEME_STORAGE_KEY, preference);
  } catch {
    // localStorage might be unavailable or full
  }

  try {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${USERHQ_THEME_COOKIE_NAME}=${preference}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    // cookies might be disabled
  }
}

export function applyThemeToDocument(preference: ThemePreference): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveEffectiveTheme(preference, systemDark);

  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolved;

  return resolved;
}
