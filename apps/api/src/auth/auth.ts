import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Db, user as userTable } from "@userhq/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { INTEGRATION_ACTOR_PREFIX } from "./principal.js";
import {
  AUTH_OUTCOME_COOKIE,
  signAuthOutcome,
} from "../analytics/auth-outcome.js";

export const AUTH: unique symbol = Symbol.for("userhq.auth");

export function createAuth(
  db: Db,
  env: Env,
  extraPlugins: BetterAuthPlugin[] = [],
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
      user: {
        create: {
          after: async (user, ctx) => {
            if (ctx)
              (ctx.context as Record<string, unknown>).userhqCreatedUser =
                user.id;
          },
        },
      },
      session: {
        create: {
          async after(session, ctx) {
            // Actual OAuth session lifecycle, never a /me refresh or guessed account age.
            try {
              const method = ctx?.params?.id ?? ctx?.path?.split("/").at(-1);
              if (
                !ctx ||
                !ctx.path?.startsWith("/callback/") ||
                typeof method !== "string" ||
                !["google", "github"].includes(method)
              )
                return;
              ctx.setCookie(
                AUTH_OUTCOME_COOKIE,
                signAuthOutcome(
                  {
                    session: session.id,
                    user: session.userId,
                    signup:
                      (ctx.context as Record<string, unknown>)
                        .userhqCreatedUser === session.userId,
                    method: method as "google" | "github",
                    expires: Date.now() + 300000,
                  },
                  env.BETTER_AUTH_SECRET,
                ),
                {
                  httpOnly: true,
                  secure: env.PUBLIC_URL.startsWith("https:"),
                  sameSite: "lax",
                  path: "/api/v1/me",
                  maxAge: 300,
                },
              );
            } catch {
              /* Auth must not depend on analytics. */
            }
          },
          async before(session) {
            if (session.userId.startsWith(INTEGRATION_ACTOR_PREFIX)) {
              throw APIError.from("FORBIDDEN", {
                code: "integration_cannot_sign_in",
                message: "Integration actors cannot sign in.",
              });
            }
            const [row] = await db
              .select({
                bannedAt: userTable.bannedAt,
                deletedAt: userTable.deletedAt,
              })
              .from(userTable)
              .where(eq(userTable.id, session.userId));
            if (row?.bannedAt || row?.deletedAt) {
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
