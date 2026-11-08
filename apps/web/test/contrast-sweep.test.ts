import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const web = path.resolve(import.meta.dirname, "..");
const checkboxFills = [
  { file: "components/webhooks/create-webhook-dialog.tsx", reason: "Native event checkbox color paints the checked control fill." },
  { file: "components/roadmap/public-columns-popover.tsx", reason: "Native public-column checkbox color paints the checked control fill." },
  { file: "components/dashboard/status-dialog.tsx", reason: "Native public-status checkbox color paints the checked control fill." },
  { file: "components/roadmap/roadmap-item-modal.tsx", reason: "Native make-public checkbox color paints the checked control fill." },
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(dir, entry.name);
    return entry.isDirectory() ? files(filename) : entry.name.endsWith(".tsx") ? [filename] : [];
  });
}

describe("accent text and focus source guard", () => {
  it("uses readable tokens outside the explicit native-checkbox fill exceptions", () => {
    const scanned = [...files(path.join(web, "app")), ...files(path.join(web, "components"))];
    const offenders: string[] = [];
    const usedExceptions = new Map<string, number>();
    for (const filename of scanned) {
      const relative = path.relative(web, filename);
      const source = readFileSync(filename, "utf8");
      const checkboxes = [...source.matchAll(/<input\b[\s\S]*?\/>/g)]
        .filter((tag) => /\btype=["']checkbox["']/.test(tag[0]));
      const raw = /\b(?:text-primary(?![\w-])(?:\/[\w.[\]%-]+)?|text-\[(?:color:)?var\(--primary\)\](?:\/[\w.[\]%-]+)?|ring-primary(?![\w\/-])|ring-\[(?:color:)?var\(--primary\)\](?:\/[\w.[\]%-]+)?)/g;
      for (const match of source.matchAll(raw)) {
        const exception = checkboxFills.find((entry) => entry.file === relative);
        const inCheckbox = checkboxes.some((tag) => match.index >= tag.index && match.index < tag.index + tag[0].length);
        if (match[0] === "text-primary" && exception && inCheckbox) {
          usedExceptions.set(relative, (usedExceptions.get(relative) ?? 0) + 1);
          continue;
        }
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${relative}:${line}: ${match[0]}`);
      }
    }
    expect(scanned.length).toBeGreaterThanOrEqual(100);
    for (const entry of checkboxFills) {
      expect(entry.reason).not.toBe("");
      expect(usedExceptions.get(entry.file), `stale checkbox exception: ${entry.file}`).toBe(1);
    }
    expect(offenders).toEqual([]);
  });
});
