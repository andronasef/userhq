import { z } from "zod";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    PUBLIC_URL: z
      .string()
      .url()
      .transform((val) => val.replace(/\/+$/, "")),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    UPLOAD_DIR: z.string().default("./.data/uploads"),
    PLATFORM_OWNER_EMAIL: z.string().email().transform((s) => s.toLowerCase()),
    SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
    SMTP_PORT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().optional()
    ),
    SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
    SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
    SMTP_FROM: z.preprocess(emptyToUndefined, z.string().email().optional()),
    SMTP_REQUIRE_TLS: z.preprocess(
      emptyToUndefined,
      z
        .union([z.boolean(), z.enum(["true", "false"])])
        .transform((v) => v === true || v === "true")
        .optional()
    ),
    VAPID_PUBLIC_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    VAPID_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    VAPID_SUBJECT: z.preprocess(
      emptyToUndefined,
      z.string().default("mailto:notifications@userhq.com")
    ),
  })
  .superRefine((data, ctx) => {
    if (data.SMTP_HOST && !data.SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_FROM"],
        message: "SMTP_FROM is required when SMTP_HOST is set",
      });
    }
    // Throwaway keys regenerate on every restart and orphan every subscription.
    if (data.NODE_ENV === "production") {
      for (const key of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export const ENV: unique symbol = Symbol.for("userhq.env");

export function loadEnv(source?: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source ?? process.env);
  if (!result.success) {
    const failingKeys = Array.from(
      new Set(result.error.issues.map((issue) => issue.path.join(".")))
    ).filter(Boolean);
    throw new Error(
      `Invalid environment configuration. Failing keys: ${failingKeys.join(", ")}`
    );
  }
  return result.data;
}
