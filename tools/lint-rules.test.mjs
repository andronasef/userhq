import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const oxlintBin = fs.existsSync(path.resolve(rootDir, "node_modules/.bin/oxlint"))
  ? path.resolve(rootDir, "node_modules/.bin/oxlint")
  : "oxlint";

function runOxlint(filePath) {
  const result = spawnSync(
    oxlintBin,
    ["-c", ".oxlintrc.json", "--format", "json", filePath],
    {
      cwd: rootDir,
      encoding: "utf8",
    }
  );
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse oxlint output: ${result.stdout} ${result.stderr}`);
  }
}

function withTempFile(relPath, content, fn) {
  const fullPath = path.resolve(rootDir, relPath);
  const dir = path.dirname(fullPath);
  const createdDir = !fs.existsSync(dir);
  if (createdDir) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, "utf8");
  try {
    return fn(relPath);
  } finally {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    if (createdDir && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
}

test("banned web imports are flagged", async (t) => {
  const bannedImports = [
    "@userhq/db",
    "drizzle-orm",
    "drizzle-orm/pg-core",
    "pg",
    "sharp",
    "next-auth",
    "radix-ui",
    "next/image",
    "next/font/google",
    "vinext",
    "vinext/server",
    "@auth/core",
    "./icon.svg?raw",
    "./icon.svg?url",
    "./icon.svg?inline",
    "better-auth",
    "better-auth/node",
  ];

  for (const imp of bannedImports) {
    await t.test(`bans import from '${imp}'`, () => {
      const code = `import dummy from '${imp}';\nconsole.log(dummy);\n`;
      withTempFile("apps/web/app/__banned_test__.ts", code, (relPath) => {
        const output = runOxlint(relPath);
        const restricted = (output.diagnostics || []).filter(
          (d) => d.code === "eslint(no-restricted-imports)"
        );
        assert.ok(
          restricted.length > 0,
          `Expected restricted import error for '${imp}', got: ${JSON.stringify(output.diagnostics)}`
        );
      });
    });
  }
});

test("allowed better-auth client imports in web produce no restricted-import diagnostic", async (t) => {
  const allowed = [
    "better-auth/react",
    "better-auth/cookies",
    "better-auth/client",
  ];

  for (const imp of allowed) {
    await t.test(`allows import from '${imp}'`, () => {
      const code = `import dummy from '${imp}';\nconsole.log(dummy);\n`;
      withTempFile("apps/web/app/__allowed_test__.ts", code, (relPath) => {
        const output = runOxlint(relPath);
        const restricted = (output.diagnostics || []).filter(
          (d) => d.code === "eslint(no-restricted-imports)"
        );
        assert.equal(
          restricted.length,
          0,
          `Expected no restricted import error for '${imp}', got: ${JSON.stringify(restricted)}`
        );
      });
    });
  }
});

test("import.meta.env in web is flagged by userhq/no-import-meta-env", () => {
  const code = `const key = import.meta.env.API_KEY;\nconsole.log(key);\n`;
  withTempFile("apps/web/lib/__env_test__.ts", code, (relPath) => {
    const output = runOxlint(relPath);
    const envErrors = (output.diagnostics || []).filter(
      (d) => d.code === "userhq(no-import-meta-env)"
    );
    assert.ok(
      envErrors.length > 0,
      `Expected userhq/no-import-meta-env error, got: ${JSON.stringify(output.diagnostics)}`
    );
  });
});

test("columns with false value under apps/api is flagged by userhq/no-exclusion-columns", () => {
  const code = `const q = { columns: { id: true, password: false } };\nconsole.log(q);\n`;
  withTempFile("apps/api/src/__columns_test__.ts", code, (relPath) => {
    const output = runOxlint(relPath);
    const colErrors = (output.diagnostics || []).filter(
      (d) => d.code === "userhq(no-exclusion-columns)"
    );
    assert.ok(
      colErrors.length > 0,
      `Expected userhq/no-exclusion-columns error in apps/api, got: ${JSON.stringify(output.diagnostics)}`
    );
  });
});

test("columns with false value under packages/db is flagged by userhq/no-exclusion-columns", () => {
  const code = `const q = { columns: { secret: false } };\nconsole.log(q);\n`;
  withTempFile("packages/db/__columns_test__.ts", code, (relPath) => {
    const output = runOxlint(relPath);
    const colErrors = (output.diagnostics || []).filter(
      (d) => d.code === "userhq(no-exclusion-columns)"
    );
    assert.ok(
      colErrors.length > 0,
      `Expected userhq/no-exclusion-columns error in packages/db, got: ${JSON.stringify(output.diagnostics)}`
    );
  });
});

test("clean control file produces zero error diagnostics", () => {
  const code = `export const add = (a: number, b: number): number => a + b;\n`;
  withTempFile("apps/web/lib/__clean_test__.ts", code, (relPath) => {
    const output = runOxlint(relPath);
    const errors = (output.diagnostics || []).filter((d) => d.severity === "error");
    assert.equal(
      errors.length,
      0,
      `Expected 0 errors on clean file, got: ${JSON.stringify(errors)}`
    );
  });
});
