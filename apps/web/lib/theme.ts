export const USERHQ_THEME_STORAGE_KEY = "userhq_theme";

export const THEME_PREFERENCES = ["system", "light", "dark", "charcoal"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark" | "charcoal";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === "charcoal") return "charcoal";
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(USERHQ_THEME_STORAGE_KEY);
    if (isThemePreference(stored)) {
      return stored;
    }
  } catch {
    // Storage blocked (sandbox, privacy mode)
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
}

export function applyThemeToDocument(preference: ThemePreference): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveEffectiveTheme(preference, systemDark);

  if (resolved === "charcoal") {
    document.documentElement.classList.add("dark", "charcoal");
  } else if (resolved === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("charcoal");
  } else {
    document.documentElement.classList.remove("dark", "charcoal");
  }

  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolved === "light" ? "light" : "dark";

  return resolved;
}

// The document is the source of truth: THEME_INIT_SCRIPT already resolved
// storage into dataset.theme before any app code ran. Storage is only read
// when the script did not run (blocked or stripped).
export function getDocumentThemePreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const fromDocument = document.documentElement.dataset.theme;
    if (isThemePreference(fromDocument)) return fromDocument;
  }
  return getStoredThemePreference();
}

// Re-resolve the current preference, e.g. when the OS scheme changes.
// An explicit light, dark, or charcoal re-applies to itself, so this is a no-op for them.
export function reapplyDocumentTheme(): ResolvedTheme {
  return applyThemeToDocument(getDocumentThemePreference());
}

// First-paint script, embedded in <head> by app/layout.tsx. Self-contained (it
// cannot import). Must stay behaviourally in step with getStoredThemePreference
// and applyThemeToDocument above; theme.test.ts runs this exact string in node:vm.
export const THEME_INIT_SCRIPT = `(function(){
  var pref = 'system';
  try {
    var stored = localStorage.getItem(${JSON.stringify(USERHQ_THEME_STORAGE_KEY)});
    if (stored === 'light' || stored === 'dark' || stored === 'charcoal' || stored === 'system') pref = stored;
  } catch (e) {}
  var isCharcoal = pref === 'charcoal';
  var isDark = pref === 'dark' || isCharcoal;
  if (pref === 'system') {
    try { isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  }
  var root = document.documentElement;
  if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
  if (isCharcoal) root.classList.add('charcoal'); else root.classList.remove('charcoal');
  root.style.colorScheme = isDark ? 'dark' : 'light';
  root.dataset.theme = pref;
})();`;
