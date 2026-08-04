import { processNotificationPush } from "../src/server/jobs/notification-push";
import { processReminders } from "../src/server/jobs/reminders";
import { pool } from "../db";

try {
  const startedAt = new Date();
  const reminders = await processReminders(startedAt);
  const push = await processNotificationPush(startedAt);
  const result = { reminders, push };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (reminders.failed || push.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
