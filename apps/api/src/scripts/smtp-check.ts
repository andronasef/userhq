import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import process from "node:process";

export type SmtpProbeResult = {
  port: number;
  mode: "starttls" | "tls" | "plain";
  ok: boolean;
  detail: string;
};

export interface RunSmtpCheckOptions {
  host: string;
  ports?: number[];
  user?: string;
  pass?: string;
  requireTls?: boolean;
  timeoutMs?: number;
}

const DEFAULT_PORTS = [587, 2525, 465];

export async function runSmtpCheck(
  opts: RunSmtpCheckOptions
): Promise<SmtpProbeResult[]> {
  const ports = opts.ports && opts.ports.length > 0 ? opts.ports : DEFAULT_PORTS;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const requireTls = opts.requireTls ?? true;
  const results: SmtpProbeResult[] = [];

  for (const port of ports) {
    const isTls = port === 465;
    const mode: "starttls" | "tls" | "plain" = isTls
      ? "tls"
      : requireTls
      ? "starttls"
      : "plain";

    const transportOptions = {
      host: opts.host,
      port,
      secure: isTls,
      requireTLS: !isTls && requireTls,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      ...(opts.user ? { auth: { user: opts.user, pass: opts.pass ?? "" } } : {}),
    };

    const transporter = nodemailer.createTransport(transportOptions as SMTPTransport.Options);
    try {
      await transporter.verify();
      results.push({ port, mode, ok: true, detail: "ok" });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      let detail = error?.message || String(err);
      if (error?.code && !detail.includes(error.code)) {
        detail = `${error.code}: ${detail}`;
      }
      if (opts.pass) {
        detail = detail.replaceAll(opts.pass, "[REDACTED]");
      }
      if (opts.user) {
        detail = detail.replaceAll(opts.user, "[REDACTED]");
      }
      results.push({ port, mode, ok: false, detail });
    } finally {
      transporter.close();
    }
  }

  return results;
}

function isDirectRun(): boolean {
  if (typeof process === "undefined" || !process.argv[1]) return false;
  try {
    const entryPath = resolve(process.argv[1]);
    const modulePath = resolve(fileURLToPath(import.meta.url));
    return entryPath === modulePath;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.error("smtp-check: SMTP_HOST environment variable is required");
    process.exit(1);
  }

  const rawPorts = process.env.SMTP_PROBE_PORTS || "587,2525,465";
  const ports = rawPorts
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => !isNaN(p) && p > 0);

  const requireTls = process.env.SMTP_REQUIRE_TLS !== "false";
  const timeoutMs = process.env.SMTP_TIMEOUT_MS
    ? parseInt(process.env.SMTP_TIMEOUT_MS, 10)
    : 10000;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const results = await runSmtpCheck({
    host,
    ports,
    user,
    pass,
    requireTls,
    timeoutMs,
  });

  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(
      `${String(result.port).padEnd(6)} ${result.mode.padEnd(10)} ${status.padEnd(6)} ${result.detail}`
    );
  }

  const working = results.find((r) => r.ok);
  if (working) {
    console.log(`smtp-check: working port ${working.port}`);
    process.exit(0);
  } else {
    console.log("smtp-check: no working port");
    process.exit(1);
  }
}

if (isDirectRun()) {
  void main();
}
