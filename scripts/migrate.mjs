import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
const client = await pool.connect();
try {
  await client.query("select pg_advisory_lock(492019)");
  await client.query("create table if not exists homi_migrations (name text primary key, applied_at timestamptz not null default now())");
  const files = (await readdir(path.resolve("drizzle"))).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const applied = await client.query("select 1 from homi_migrations where name = $1", [name]);
    if (applied.rowCount) continue;
    const sql = await readFile(path.resolve("drizzle", name), "utf8");
    await client.query("begin");
    try {
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await client.query(statement);
      await client.query("insert into homi_migrations (name) values ($1)", [name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(492019)").catch(() => undefined);
  client.release();
  await pool.end();
}

