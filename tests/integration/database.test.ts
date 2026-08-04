import { afterAll, describe, expect, test } from "vitest";
import { Pool, type PoolClient } from "pg";

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === "true";
const connectionString =
  process.env.SEED_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://homi:homi@127.0.0.1:5432/homi";
const pool = new Pool({ connectionString, max: 1 });

afterAll(async () => {
  await pool.end();
});

async function inRollbackTransaction(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  await client.query("begin");
  try {
    await run(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe.runIf(runIntegrationTests)(
  "PostgreSQL tenant and idempotency boundaries",
  () => {
    test("keeps homes tenant-scoped and rejects duplicate task completions", async () => {
      await inRollbackTransaction(async (client) => {
        const owner = await client.query<{ id: string }>(
          `insert into "user" (name, email, email_verified)
         values ($1, $2, true) returning id`,
          ["Integration Owner", `owner-${crypto.randomUUID()}@example.test`],
        );
        const outsider = await client.query<{ id: string }>(
          `insert into "user" (name, email, email_verified)
         values ($1, $2, true) returning id`,
          [
            "Integration Outsider",
            `outsider-${crypto.randomUUID()}@example.test`,
          ],
        );
        const ownerId = owner.rows[0]!.id;
        const outsiderId = outsider.rows[0]!.id;

        const home = await client.query<{ id: string }>(
          `insert into homes (owner_id, name, type, timezone)
         values ($1, 'Integration Home', 'HOUSE', 'UTC') returning id`,
          [ownerId],
        );
        const otherHome = await client.query<{ id: string }>(
          `insert into homes (owner_id, name, type, timezone)
         values ($1, 'Other Home', 'HOUSE', 'UTC') returning id`,
          [outsiderId],
        );
        const homeId = home.rows[0]!.id;
        const otherHomeId = otherHome.rows[0]!.id;

        await client.query(
          `insert into home_members (home_id, user_id, role)
         values ($1, $2, 'OWNER'), ($3, $4, 'OWNER')`,
          [homeId, ownerId, otherHomeId, outsiderId],
        );

        const task = await client.query<{ id: string }>(
          `insert into maintenance_tasks
          (home_id, title, frequency_type, frequency_interval, next_due_at, created_by)
         values ($1, 'Integration filter check', 'MONTHLY', 1, now(), $2)
         returning id`,
          [homeId, ownerId],
        );

        const ownerVisibleHomes = await client.query<{ id: string }>(
          `select h.id
           from homes h
           join home_members hm on hm.home_id = h.id
          where hm.user_id = $1 and h.id = $2`,
          [ownerId, otherHomeId],
        );
        expect(ownerVisibleHomes.rows).toHaveLength(0);

        const idempotencyKey = crypto.randomUUID();
        await client.query(
          `insert into maintenance_records
          (idempotency_key, task_id, home_id, completed_by)
         values ($1, $2, $3, $4)`,
          [idempotencyKey, task.rows[0]!.id, homeId, ownerId],
        );

        await client.query("savepoint duplicate_completion");
        let duplicateConstraintCode: string | undefined;
        try {
          await client.query(
            `insert into maintenance_records
            (idempotency_key, task_id, home_id, completed_by)
           values ($1, $2, $3, $4)`,
            [idempotencyKey, task.rows[0]!.id, homeId, ownerId],
          );
        } catch (error) {
          duplicateConstraintCode = (error as { code?: string }).code;
          await client.query("rollback to savepoint duplicate_completion");
        }
        expect(duplicateConstraintCode).toBe("23505");
      });
    });

    test("persists home-scoped templates and unique browser subscriptions", async () => {
      await inRollbackTransaction(async (client) => {
        const firstUser = await client.query<{ id: string }>(
          `insert into "user" (name, email, email_verified)
           values ($1, $2, true) returning id`,
          ["Template Owner", `template-${crypto.randomUUID()}@example.test`],
        );
        const secondUser = await client.query<{ id: string }>(
          `insert into "user" (name, email, email_verified)
           values ($1, $2, true) returning id`,
          ["Push User", `push-${crypto.randomUUID()}@example.test`],
        );
        const ownerId = firstUser.rows[0]!.id;
        const pushUserId = secondUser.rows[0]!.id;
        const home = await client.query<{ id: string }>(
          `insert into homes (owner_id, name, type, timezone)
           values ($1, 'Template Home', 'HOUSE', 'UTC') returning id`,
          [ownerId],
        );
        const homeId = home.rows[0]!.id;
        await client.query(
          `insert into home_members (home_id, user_id, role)
           values ($1, $2, 'OWNER')`,
          [homeId, ownerId],
        );

        const template = await client.query<{ home_id: string; title: string }>(
          `insert into maintenance_templates
            (home_id, created_by, title, category, frequency_type,
             frequency_interval, priority)
           values ($1, $2, 'Inspect rainwater pump', 'Garden', 'MONTHLY', 1, 'MEDIUM')
           returning home_id, title`,
          [homeId, ownerId],
        );
        expect(template.rows[0]).toMatchObject({
          home_id: homeId,
          title: "Inspect rainwater pump",
        });

        const endpoint = `https://push.example/${crypto.randomUUID()}`;
        await client.query(
          `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
           values ($1, $2, $3, $4)`,
          [pushUserId, endpoint, "p".repeat(60), "a".repeat(24)],
        );
        await client.query("savepoint duplicate_push_endpoint");
        let duplicateConstraintCode: string | undefined;
        try {
          await client.query(
            `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
             values ($1, $2, $3, $4)`,
            [ownerId, endpoint, "q".repeat(60), "b".repeat(24)],
          );
        } catch (error) {
          duplicateConstraintCode = (error as { code?: string }).code;
          await client.query("rollback to savepoint duplicate_push_endpoint");
        }
        expect(duplicateConstraintCode).toBe("23505");
      });
    });
  },
);
