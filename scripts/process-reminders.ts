import { processReminders } from "../src/server/jobs/reminders";
import { pool } from "../db";
try {
  const result = await processReminders();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.failed) process.exitCode = 1;
} finally {
  await pool.end();
}

