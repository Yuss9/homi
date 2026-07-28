import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.SEED_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://homi:homi@127.0.0.1:5432/homi",
  },
  strict: true,
  verbose: true,
});
