import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export interface CreateSmtpTransportOptions {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  requireTls?: boolean;
  timeoutMs?: number;
}

export function createSmtpTransport(
  opts: CreateSmtpTransportOptions
): Transporter<SMTPTransport.SentMessageInfo> {
  const isTls = opts.port === 465;
  const requireTls = opts.requireTls ?? true;
  const timeoutMs = opts.timeoutMs ?? 10000;

  const transportOptions: SMTPTransport.Options = {
    host: opts.host,
    port: opts.port,
    secure: isTls,
    requireTLS: !isTls && requireTls,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    ...(opts.user ? { auth: { user: opts.user, pass: opts.pass ?? "" } } : {}),
  };

  return nodemailer.createTransport(transportOptions);
}
