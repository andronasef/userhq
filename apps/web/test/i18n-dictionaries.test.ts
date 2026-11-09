import { describe, it, expect } from "vitest";
import { SUPPORTED_LOCALES } from "@userhq/types";
import { DICTIONARIES } from "../lib/i18n/dictionaries";

function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("dictionaries", () => {
  const enKeys = leaves(DICTIONARIES.en).sort();

  it.each(SUPPORTED_LOCALES)("%s defines every key with non-empty text", (locale) => {
    expect(leaves(DICTIONARIES[locale]).sort()).toEqual(enKeys);
    const dict = DICTIONARIES[locale] as unknown as Record<string, unknown>;
    for (const key of enKeys) {
      const value = key.split(".").reduce<any>((o, p) => o[p], dict);
      expect(value.trim(), `${locale}:${key}`).not.toBe("");
    }
  });
});
