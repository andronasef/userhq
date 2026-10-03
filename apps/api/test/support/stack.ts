import { testUtils, type TestHelpers } from "better-auth/plugins";
import { createDb, type Db, schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { createAuth, type Auth } from "../../src/auth/auth.js";
import type { Env } from "../../src/env.js";
import { signedInCookie } from "./auth-helpers.js";

export const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
export const databaseUrl = process.env.E2E_DATABASE_URL!;

export function stackEnv(): Env {
  return {
    NODE_ENV: "production",
    PORT: 4000,
    DATABASE_URL: databaseUrl,
    PUBLIC_URL: baseUrl,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ??
      "428905b3e64f89d34cb01676f112e472652b0475f32ebf25091bcae52d3eb03a",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "dummy-google-client-id",
    GOOGLE_CLIENT_SECRET:
      process.env.GOOGLE_CLIENT_SECRET ?? "dummy-google-client-secret",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "dummy-github-client-id",
    GITHUB_CLIENT_SECRET:
      process.env.GITHUB_CLIENT_SECRET ?? "dummy-github-client-secret",
    UPLOAD_DIR: "/data/uploads",
    PLATFORM_OWNER_EMAIL:
      process.env.PLATFORM_OWNER_EMAIL ?? "owner@userhq.test",
  };
}

export interface StackContext {
  db: Db;
  pool: pg.Pool;
  auth: Auth;
  test: TestHelpers;
  env: Env;
  close(): Promise<void>;
}

export async function openStack(): Promise<StackContext> {
  const { db, pool } = createDb(databaseUrl);
  const env = stackEnv();
  const auth = createAuth(db, env, [testUtils()]);
  const ctx = await (auth as any).$context;
  const test: TestHelpers = ctx.test;

  const close = async () => {
    await pool.end();
  };

  return { db, pool, auth, test, env, close };
}

export async function mintSession(
  stack: StackContext,
  opts?: { name?: string; email?: string; emailVerified?: boolean }
): Promise<{ cookie: string; userId: string; email: string }> {
  return signedInCookie(stack.test, opts);
}

export async function ownerSession(
  stack: StackContext
): Promise<{ cookie: string; userId: string; email: string; created: boolean }> {
  const ownerEmail = (stack.env.PLATFORM_OWNER_EMAIL || "owner@userhq.test").toLowerCase();

  const [existing] = await stack.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, ownerEmail))
    .limit(1);

  if (existing) {
    if (!existing.emailVerified) {
      throw new Error(`Platform owner ${ownerEmail} exists but emailVerified is false`);
    }
    const cookies = await stack.test.getCookies({
      userId: existing.id,
      domain: "localhost",
    });
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return {
      cookie,
      userId: existing.id,
      email: existing.email,
      created: false,
    };
  }

  const minted = await mintSession(stack, {
    name: "Platform Owner",
    email: ownerEmail,
    emailVerified: true,
  });

  return {
    ...minted,
    created: true,
  };
}

export async function apiCall(
  path: string,
  opts?: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const url = `${baseUrl}${path}`;
  const headers = new Headers(opts?.headers);
  headers.set("Origin", baseUrl);

  if (opts?.cookie) {
    headers.set("Cookie", opts.cookie);
  }

  let body: BodyInit | undefined;
  if (opts?.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(opts.body);
    }
  }

  return fetch(url, {
    method: opts?.method ?? (opts?.body ? "POST" : "GET"),
    headers,
    body,
  });
}

export async function seedWorkspaceRows(
  stack: StackContext,
  opts: {
    userId: string;
    name: string;
    slug: string;
    role?: "owner" | "admin";
  }
): Promise<{ id: string; slug: string }> {
  const id = crypto.randomUUID();
  await stack.db.insert(schema.workspaces).values({
    id,
    name: opts.name,
    slug: opts.slug,
  });
  await stack.db.insert(schema.workspaceMembers).values({
    workspaceId: id,
    userId: opts.userId,
    role: opts.role ?? "owner",
  });
  return { id, slug: opts.slug };
}

export async function cleanupWorkspaces(
  stack: StackContext,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await stack.db
    .delete(schema.workspaces)
    .where(inArray(schema.workspaces.id, ids));
}
