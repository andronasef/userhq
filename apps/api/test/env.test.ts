import { describe, expect, it } from "vitest";
import { loadEnv, type Env } from "../src/env.js";
import { getVapidKeys } from "../src/push/push.config.js";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  PUBLIC_URL: "http://localhost:3999",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_CLIENT_SECRET: "x",
  GITHUB_CLIENT_ID: "x",
  GITHUB_CLIENT_SECRET: "x",
  PLATFORM_OWNER_EMAIL: "owner@test.com",
};
const keys = { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" };

describe("VAPID configuration", () => {
  it("production without VAPID keys fails naming both", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/VAPID_PUBLIC_KEY.*VAPID_PRIVATE_KEY|VAPID_PRIVATE_KEY.*VAPID_PUBLIC_KEY/);
    expect(() => loadEnv({ ...base, NODE_ENV: "production", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "" })).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it("production with only one key still fails", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", VAPID_PUBLIC_KEY: "pub" })).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it("production with both keys, and development without keys, load", () => {
    expect(loadEnv({ ...base, NODE_ENV: "production", ...keys }).VAPID_PUBLIC_KEY).toBe("pub");
    expect(() => loadEnv({ ...base, NODE_ENV: "development" })).not.toThrow();
  });

  it("getVapidKeys throws in production without keys even after keys were cached", () => {
    // Warm the module cache with ephemeral dev keys first.
    expect(getVapidKeys({ NODE_ENV: "test" } as Env).publicKey.length).toBeGreaterThan(10);
    expect(() => getVapidKeys({ NODE_ENV: "production" } as Env)).toThrow(/VAPID_PUBLIC_KEY.*VAPID_PRIVATE_KEY/);
  });
});
