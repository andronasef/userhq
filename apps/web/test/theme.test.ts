import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDocumentThemePreference,
  isThemePreference,
  reapplyDocumentTheme,
  resolveEffectiveTheme,
  saveThemePreference,
  THEME_INIT_SCRIPT,
  THEME_PREFERENCES,
  USERHQ_THEME_STORAGE_KEY,
} from "../lib/theme";

type Stored = string | null | "throw";

function fakeEnv(opts: { stored?: Stored; osDark?: boolean; dataset?: string } = {}) {
  const classes = new Set<string>();
  const dataset: Record<string, string> = {};
  if (opts.dataset !== undefined) dataset.theme = opts.dataset;
  const style: Record<string, string> = {};
  const cookieSet = vi.fn();
  const writes: Record<string, string> = {};
  const getItem = vi.fn((key: string) => {
    if (opts.stored === "throw") throw new Error("blocked");
    expect(key).toBe(USERHQ_THEME_STORAGE_KEY);
    return opts.stored ?? null;
  });
  const localStorage = {
    getItem,
    setItem: (k: string, v: string) => {
      writes[k] = v;
    },
  };
  const mq = { matches: !!opts.osDark };
  const window = { localStorage, matchMedia: () => mq };
  const documentElement = {
    classList: {
      add: (...c: string[]) => c.forEach((cls) => classes.add(cls)),
      remove: (...c: string[]) => c.forEach((cls) => classes.delete(cls)),
      contains: (c: string) => classes.has(c),
    },
    style,
    dataset,
  };
  const document = {
    documentElement,
    get cookie() {
      return "";
    },
    set cookie(v: string) {
      cookieSet(v);
    },
  };
  return { classes, dataset, style, cookieSet, writes, getItem, mq, window, document, localStorage };
}

function runScript(opts: Parameters<typeof fakeEnv>[0]) {
  const env = fakeEnv(opts);
  vm.runInNewContext(THEME_INIT_SCRIPT, {
    window: env.window,
    document: env.document,
    localStorage: env.localStorage,
  });
  return env;
}

function install(opts: Parameters<typeof fakeEnv>[0]) {
  const env = fakeEnv(opts);
  vi.stubGlobal("window", env.window);
  vi.stubGlobal("document", env.document);
  return env;
}

afterEach(() => vi.unstubAllGlobals());

describe("THEME_INIT_SCRIPT (first paint)", () => {
  it("stored dark beats OS light", () => {
    const e = runScript({ stored: "dark", osDark: false });
    expect(e.classes.has("dark")).toBe(true);
    expect(e.classes.has("charcoal")).toBe(false);
    expect(e.style.colorScheme).toBe("dark");
    expect(e.dataset.theme).toBe("dark");
  });

  it("stored charcoal beats OS light", () => {
    const e = runScript({ stored: "charcoal", osDark: false });
    expect(e.classes.has("dark")).toBe(true);
    expect(e.classes.has("charcoal")).toBe(true);
    expect(e.style.colorScheme).toBe("dark");
    expect(e.dataset.theme).toBe("charcoal");
  });

  it("stored charcoal beats OS dark", () => {
    const e = runScript({ stored: "charcoal", osDark: true });
    expect(e.classes.has("dark")).toBe(true);
    expect(e.classes.has("charcoal")).toBe(true);
    expect(e.style.colorScheme).toBe("dark");
    expect(e.dataset.theme).toBe("charcoal");
  });

  it("stored light beats OS dark", () => {
    const e = runScript({ stored: "light", osDark: true });
    expect(e.classes.has("dark")).toBe(false);
    expect(e.classes.has("charcoal")).toBe(false);
    expect(e.style.colorScheme).toBe("light");
    expect(e.dataset.theme).toBe("light");
  });

  it("nothing stored follows OS dark", () => {
    const e = runScript({ stored: null, osDark: true });
    expect(e.classes.has("dark")).toBe(true);
    expect(e.style.colorScheme).toBe("dark");
    expect(e.dataset.theme).toBe("system");
  });

  it("a throwing storage read still honours the OS scheme", () => {
    const e = runScript({ stored: "throw", osDark: true });
    expect(e.classes.has("dark")).toBe(true);
    expect(e.dataset.theme).toBe("system");
  });

  it("ignores a junk stored value", () => {
    const e = runScript({ stored: "purple", osDark: false });
    expect(e.classes.has("dark")).toBe(false);
    expect(e.dataset.theme).toBe("system");
  });
});

describe("getDocumentThemePreference", () => {
  it("returns a valid dataset value without touching storage", () => {
    const e = install({ dataset: "dark", stored: "light" });
    expect(getDocumentThemePreference()).toBe("dark");
    expect(e.getItem).not.toHaveBeenCalled();
  });

  it("falls back to storage when the dataset is missing or invalid", () => {
    install({ stored: "light" });
    expect(getDocumentThemePreference()).toBe("light");
    install({ dataset: "bogus", stored: "dark" });
    expect(getDocumentThemePreference()).toBe("dark");
  });

  it("returns system when there is neither", () => {
    install({ stored: null });
    expect(getDocumentThemePreference()).toBe("system");
  });
});

describe("reapplyDocumentTheme (OS scheme changed)", () => {
  it("system with OS now dark goes dark", () => {
    const e = install({ dataset: "system", osDark: true });
    expect(reapplyDocumentTheme()).toBe("dark");
    expect(e.classes.has("dark")).toBe(true);
  });

  it("explicit light with blocked storage is not overridden by OS dark", () => {
    const e = install({ dataset: "light", stored: "throw", osDark: true });
    expect(reapplyDocumentTheme()).toBe("light");
    expect(e.classes.has("dark")).toBe(false);
    expect(e.dataset.theme).toBe("light");
  });

  it("explicit dark stays dark with OS light", () => {
    const e = install({ dataset: "dark", osDark: false });
    e.classes.add("dark");
    expect(reapplyDocumentTheme()).toBe("dark");
    expect(e.classes.has("dark")).toBe(true);
    expect(e.classes.has("charcoal")).toBe(false);
  });

  it("explicit charcoal stays charcoal with OS light", () => {
    const e = install({ dataset: "charcoal", osDark: false });
    e.classes.add("dark");
    e.classes.add("charcoal");
    expect(reapplyDocumentTheme()).toBe("charcoal");
    expect(e.classes.has("dark")).toBe(true);
    expect(e.classes.has("charcoal")).toBe(true);
  });
});

describe("saveThemePreference", () => {
  it("writes storage only and never touches the cookie", () => {
    const e = install({});
    saveThemePreference("dark");
    expect(e.writes[USERHQ_THEME_STORAGE_KEY]).toBe("dark");
    expect(e.cookieSet).not.toHaveBeenCalled();

    saveThemePreference("charcoal");
    expect(e.writes[USERHQ_THEME_STORAGE_KEY]).toBe("charcoal");
    expect(e.cookieSet).not.toHaveBeenCalled();
  });
});

describe("Theme resolution logic", () => {
  it("recognizes valid theme preferences", () => {
    for (const theme of THEME_PREFERENCES) {
      expect(isThemePreference(theme)).toBe(true);
    }
    expect(isThemePreference("invalid")).toBe(false);
    expect(isThemePreference("")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("resolves charcoal preference to charcoal regardless of system", () => {
    expect(resolveEffectiveTheme("charcoal", false)).toBe("charcoal");
    expect(resolveEffectiveTheme("charcoal", true)).toBe("charcoal");
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
