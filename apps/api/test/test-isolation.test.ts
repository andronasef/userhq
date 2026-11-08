import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createTestApp } from "./support/test-app.js";

// Every socket a test opens must be bound to 127.0.0.1. supertest starts its own wildcard listener on an
// ephemeral port for any app that is not already listening; the kernel then may hand it a port that another
// process holds on 127.0.0.1 and the request is answered by that process (see quick-261108-bzd DIAGNOSIS.md).

const testDir = path.dirname(fileURLToPath(import.meta.url));
const supportApp = path.join(testDir, "support", "test-app.ts");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "e2e" || e.name === "browser" ? [] : walk(p);
    return e.name.endsWith(".ts") ? [p] : [];
  });
}

describe("test servers listen on 127.0.0.1 only", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp?.close();
  });

  it("createTestApp owns one 127.0.0.1 listener that supertest reuses", async () => {
    const before = testApp.http.address();
    expect(before).toMatchObject({ address: "127.0.0.1" });
    expect((before as { port: number }).port).toBeGreaterThan(0);
    for (let i = 0; i < 2; i++) {
      await request(testApp.http).get("/api/v1/health");
    }
    expect(testApp.http.address()).toEqual(before);
  });

  it("no test file listens on another address or listens a createTestApp app", () => {
    const offenders: string[] = [];
    let sites = 0;
    for (const file of walk(testDir)) {
      if (file === path.join(testDir, "test-isolation.test.ts")) continue;
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const at = `${path.relative(testDir, file)}:${i + 1}`;
        const m = line.match(/\.listen\(([^)]*)\)?/);
        if (!m) return;
        sites++;
        if (!/["']127\.0\.0\.1["']/.test(m[1])) offenders.push(`${at} listens without host "127.0.0.1": ${line.trim()}`);
        if (/\bapp\.listen\(|\.app\.listen\(|\bhttp\.listen\(/.test(line) && file !== supportApp) {
          offenders.push(`${at} listens a createTestApp app a second time: ${line.trim()}`);
        }
      });
    }
    expect(sites).toBeGreaterThanOrEqual(6);
    expect(offenders).toEqual([]);
  });
});
