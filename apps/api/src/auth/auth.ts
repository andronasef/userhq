import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Db, user as userTable } from "@userhq/db";
import { eq } from "drizzle-orm";
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
    user: {
      additionalFields: {
        bannedAt: { type: "date", required: false, input: false },
        deletedAt: { type: "date", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          async before(session) {
            const [row] = await db
              .select({ bannedAt: userTable.bannedAt })
              .from(userTable)
              .where(eq(userTable.id, session.userId));
            if (row?.bannedAt) {
              throw APIError.from("FORBIDDEN", {
                code: "account_banned",
                message: "This account can't sign in.",
              });
            }
          },
        },
      },
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
