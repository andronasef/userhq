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
  })
  .superRefine((data, ctx) => {
    if (data.SMTP_HOST && !data.SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_FROM"],
        message: "SMTP_FROM is required when SMTP_HOST is set",
      });
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
