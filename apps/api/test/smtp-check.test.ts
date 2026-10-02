import { describe, it, expect, beforeAll } from "vitest";
import { runSmtpCheck } from "../src/scripts/smtp-check.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../dist/scripts/smtp-check.js");
const mailpitHost = process.env.MAILPIT_HOST || "127.0.0.1";
const mailpitApiUrl = `http://${mailpitHost}:8025/api/v1/messages`;

async function getMailpitMessageCount(): Promise<number> {
  const res = await fetch(mailpitApiUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Mailpit messages: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { total: number };
  return data.total;
}

describe("SMTP reachability probe (Plan 01-09 Task 3)", () => {
  const secretPass = "super-secret-smtp-password-xyz987";

  beforeAll(async () => {
    // Verify Mailpit message API is reachable
    const count = await getMailpitMessageCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("probes Mailpit at port 1025 with requireTls: false and succeeds", async () => {
    const results = await runSmtpCheck({
      host: mailpitHost,
      ports: [1025],
      requireTls: false,
      user: "test-user",
      pass: secretPass,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      port: 1025,
      mode: "plain",
      ok: true,
      detail: "ok",
    });
  });

  it("fails against closed port 1 with ECONNREFUSED detail", async () => {
    const results = await runSmtpCheck({
      host: "127.0.0.1",
      ports: [1],
      timeoutMs: 2000,
      pass: secretPass,
    });

    expect(results).toHaveLength(1);
    expect(results[0].port).toBe(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].detail).toMatch(/ECONNREFUSED/);
    expect(results[0].detail).not.toContain(secretPass);
  });

  it("CLI exits 0 on working Mailpit port and never prints credentials", () => {
    const child = spawnSync("node", [scriptPath], {
      env: {
        ...process.env,
        SMTP_HOST: mailpitHost,
        SMTP_PROBE_PORTS: "1025",
        SMTP_REQUIRE_TLS: "false",
        SMTP_USER: "operator",
        SMTP_PASS: secretPass,
      },
      encoding: "utf-8",
    });

    expect(child.status).toBe(0);
    const combinedOutput = (child.stdout || "") + (child.stderr || "");
    expect(combinedOutput).toContain("1025");
    expect(combinedOutput).toContain("smtp-check: working port 1025");
    expect(combinedOutput).not.toContain(secretPass);
    expect(combinedOutput).not.toContain("operator");
  });

  it("CLI exits 1 when no ports pass, outputs error details and never prints credentials", () => {
    const child = spawnSync("node", [scriptPath], {
      env: {
        ...process.env,
        SMTP_HOST: "127.0.0.1",
        SMTP_PROBE_PORTS: "1",
        SMTP_TIMEOUT_MS: "2000",
        SMTP_USER: "operator",
        SMTP_PASS: secretPass,
      },
      encoding: "utf-8",
    });

    expect(child.status).toBe(1);
    const combinedOutput = (child.stdout || "") + (child.stderr || "");
    expect(combinedOutput).toContain("smtp-check: no working port");
    expect(combinedOutput).toMatch(/ECONNREFUSED/);
    expect(combinedOutput).not.toContain(secretPass);
    expect(combinedOutput).not.toContain("operator");
  });

  it("does not send any email during probe (Mailpit message count unchanged)", async () => {
    const countBefore = await getMailpitMessageCount();

    // Run programmatic probe
    const probeResults = await runSmtpCheck({
      host: mailpitHost,
      ports: [1025],
      requireTls: false,
      user: "test-sender",
      pass: "test-pass",
    });
    expect(probeResults[0].ok).toBe(true);

    // Run CLI probe
    const child = spawnSync("node", [scriptPath], {
      env: {
        ...process.env,
        SMTP_HOST: mailpitHost,
        SMTP_PROBE_PORTS: "1025",
        SMTP_REQUIRE_TLS: "false",
        SMTP_USER: "cli-sender",
        SMTP_PASS: "cli-pass",
      },
      encoding: "utf-8",
    });
    expect(child.status).toBe(0);

    const countAfter = await getMailpitMessageCount();
    expect(countAfter).toBe(countBefore);
  });
});
