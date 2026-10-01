import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Db } from "@userhq/db";
import type { Env } from "../env.js";

export const AUTH: unique symbol = Symbol.for("userhq.auth");

export function createAuth(
  db: Db,
  env: Env,
  extraPlugins: BetterAuthPlugin[] = []
) {
  return betterAuth({
    baseURL: env.PUBLIC_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: {
      disableOriginCheck: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 1_209_600,
      updateAge: 86_400,
    },
    plugins: extraPlugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
