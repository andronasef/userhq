import { describe, expect, it } from "vitest";
import { initials } from "./initials.js";

describe("initials", () => {
  it("extracts first letter of first two words", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("handles single-word name", () => {
    expect(initials("octocat")).toBe("O");
  });

  it("handles leading, trailing, and multiple spaces", () => {
    expect(initials("  jean-luc   picard ")).toBe("JP");
  });

  it("takes only first two words when three or more words present", () => {
    expect(initials("ada lovelace byron")).toBe("AL");
  });

  it("returns empty string when name has no letters", () => {
    expect(initials("123 456")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(initials("")).toBe("");
  });

  it("handles Unicode letters with diacritics", () => {
    expect(initials("émile zola")).toBe("ÉZ");
  });
});
