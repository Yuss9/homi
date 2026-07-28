import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_PRODUCT_NAME: z.string().default("Homi"),
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default("support@homi.local"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://homi:homi@127.0.0.1:5432/homi"),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    BETTER_AUTH_SECRET: z.string().min(32).default("development-only-secret-change-before-production"),
    SMTP_HOST: z.string().default("127.0.0.1"),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default("Homi <no-reply@homi.local>"),
    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_PATH: z.string().default("./data/uploads"),
    S3_ENDPOINT: optionalUrl,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("homi-private"),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
    S3_SERVER_SIDE_ENCRYPTION: z.enum(["", "AES256"]).default(""),
    REDIS_URL: optionalUrl,
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
    CRON_SECRET: z.string().min(24).default("development-cron-secret"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SUPPORT_EMAIL: z.string().email().default("support@homi.local"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_PROVIDER === "s3") {
      for (const key of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required for S3` });
      }
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "Google OAuth variables must be provided together",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= envSchema.parse(process.env);
  return cached;
}

export function assertProductionEnv(): void {
  const env = getEnv();
  if (env.NODE_ENV !== "production") return;
  const unsafe = [
    !process.env.DATABASE_URL && "DATABASE_URL",
    !process.env.BETTER_AUTH_SECRET && "BETTER_AUTH_SECRET",
    !process.env.CRON_SECRET && "CRON_SECRET",
  ].filter(Boolean);
  if (unsafe.length) throw new Error(`Missing production environment variables: ${unsafe.join(", ")}`);
}
