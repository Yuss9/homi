import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as coreSchema from "./schema";
import * as highValueSchema from "./high-value-schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://homi:homi@127.0.0.1:5432/homi";

const globalForDb = globalThis as unknown as { homiPool?: Pool };

export const pool =
  globalForDb.homiPool ??
  new Pool({
    connectionString: databaseUrl,
    max: process.env.NODE_ENV === "production" ? 20 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.homiPool = pool;

export const db = drizzle(pool, {
  schema: { ...coreSchema, ...highValueSchema },
});

export async function checkDatabase(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("select 1");
    return true;
  } finally {
    client.release();
  }
}
