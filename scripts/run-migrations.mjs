import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let localDatabaseUrl;
if (existsSync(".env")) {
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  const seedLine = lines.find((entry) => entry.startsWith("SEED_DATABASE_URL="));
  const databaseLine = lines.find((entry) => entry.startsWith("DATABASE_URL="));
  localDatabaseUrl = (seedLine ?? databaseLine)?.split("=").slice(1).join("=").trim();
}
const databaseUrl = process.env.TEST_DATABASE_URL || localDatabaseUrl || process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write("Set DATABASE_URL or SEED_DATABASE_URL before applying migrations.\n");
  process.exit(1);
}
const result = spawnSync("node", ["scripts/migrate.mjs"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
process.exit(result.status ?? 1);
