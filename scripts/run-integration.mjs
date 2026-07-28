import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let localSeedUrl;
if (existsSync(".env")) {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("SEED_DATABASE_URL="));
  localSeedUrl = line?.slice("SEED_DATABASE_URL=".length).trim();
}

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || localSeedUrl || process.env.DATABASE_URL;
if (!testDatabaseUrl) {
  process.stderr.write(
    "Set TEST_DATABASE_URL, SEED_DATABASE_URL, or DATABASE_URL before running integration tests.\n",
  );
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32"
    ? "node_modules\\.bin\\vitest.cmd"
    : "node_modules/.bin/vitest",
  ["run", "tests/integration"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RUN_INTEGRATION_TESTS: "true",
      TEST_DATABASE_URL: testDatabaseUrl,
      SEED_DATABASE_URL: testDatabaseUrl,
    },
  },
);
process.exit(result.status ?? 1);
