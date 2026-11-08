import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import pg from "pg";
const { Client } = pg;
import { Test } from "@nestjs/testing";
import type { Type } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { testUtils, type TestHelpers } from "better-auth/plugins";
import { createDb, runMigrations, type Db } from "@userhq/db";
import { AppModule, configureApp } from "../../src/app.module.js";
import { createAuth, type Auth } from "../../src/auth/auth.js";
import type { Env } from "../../src/env.js";
import { OUTBOUND_NETWORK, type OutboundNetwork } from "../../src/common/outbound-http.js";
import { fixtureOutboundNetwork } from "./outbound-network.js";

export async function createTestDatabase(): Promise<{
  url: string;
  drop(): Promise<void>;
}> {
  const adminUrl =
    process.env.TEST_DATABASE_ADMIN_URL ??
    "postgres://userhq:userhq@127.0.0.1:5432/postgres";
  const dbName = `userhq_test_${randomBytes(4).toString("hex")}`;
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  try {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminClient.end();
  }

  const parsed = new URL(adminUrl);
  parsed.pathname = `/${dbName}`;
  const url = parsed.toString();

  await runMigrations({ connectionString: url });

  const drop = async () => {
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    } finally {
      await client.end();
    }
  };

  return { url, drop };
}

export async function createTestApp(
  overrides?: Partial<Env> & { extraControllers?: Type[]; outboundNetwork?: OutboundNetwork }
): Promise<{
  app: NestExpressApplication;
  http: Server;
  auth: Auth;
  test: TestHelpers;
  db: Db;
  env: Env;
  close(): Promise<void>;
}> {
  const testDb = await createTestDatabase();
  const env: Env = {
    NODE_ENV: "test",
    PORT: 3999,
    DATABASE_URL: testDb.url,
    PUBLIC_URL: overrides?.PUBLIC_URL ?? "http://localhost:3999",
    BETTER_AUTH_SECRET:
      overrides?.BETTER_AUTH_SECRET ??
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    GOOGLE_CLIENT_ID: overrides?.GOOGLE_CLIENT_ID ?? "dummy-google-client-id",
    GOOGLE_CLIENT_SECRET:
      overrides?.GOOGLE_CLIENT_SECRET ?? "dummy-google-client-secret",
    GITHUB_CLIENT_ID: overrides?.GITHUB_CLIENT_ID ?? "dummy-github-client-id",
    GITHUB_CLIENT_SECRET:
      overrides?.GITHUB_CLIENT_SECRET ?? "dummy-github-client-secret",
    UPLOAD_DIR:
      overrides?.UPLOAD_DIR ??
      path.join(
        os.tmpdir(),
        "userhq-test-uploads-" + randomBytes(4).toString("hex")
      ),
    PLATFORM_OWNER_EMAIL:
      overrides?.PLATFORM_OWNER_EMAIL ?? "owner@example.test",
    ...overrides,
  };

  const { db, pool } = createDb(env.DATABASE_URL);
  // pg-pool resolves end() before the underlying clients emit end. Wait for those terminal events
  // before DROP ... FORCE, or PostgreSQL can kill a socket still completing its graceful shutdown.
  const clientEnds = new Set<Promise<void>>();
  pool.on("connect", (client) => {
    const ended = new Promise<void>((resolve) => client.once("end", resolve));
    clientEnds.add(ended);
    void ended.then(() => clientEnds.delete(ended));
  });
  const auth = createAuth(db, env, [testUtils()]);
  const ctx = await (auth as any).$context;
  const test: TestHelpers = ctx.test;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register({ env, db, pool, auth })],
    controllers: overrides?.extraControllers ?? [],
  }).overrideProvider(OUTBOUND_NETWORK)
    .useValue(overrides?.outboundNetwork ?? fixtureOutboundNetwork).compile();

  const app =
    moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
  configureApp(app, env);
  await app.init();
  // Invariant: every listener in the suite binds 127.0.0.1. supertest only starts its own wildcard listener
  // when the server is not already listening, and a wildcard ephemeral port can be handed a port that another
  // process holds on 127.0.0.1, so a request would be answered by that process. A loopback bind is
  // conflict-aware, so the kernel never picks a port that is taken. See quick-261108-bzd DIAGNOSIS.md.
  await app.listen(0, "127.0.0.1");

  const http = app.getHttpServer();

  const close = async () => {
    await app.close();
    await pool.end().catch(() => {});
    await Promise.all(clientEnds);
    await testDb.drop();
  };

  return { app, http, auth, test, db, env, close };
}

export { signedInCookie } from "./auth-helpers.js";
