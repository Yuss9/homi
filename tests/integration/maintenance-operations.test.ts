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

async function rollback(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  await client.query("begin");
  try {
    await run(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe.runIf(runIntegrationTests)("maintenance operations schema", () => {
  test("persists checklists, stock, budgets, replacements, and insurance inventory", async () => {
    await rollback(async (client) => {
      const owner = await client.query<{ id: string }>(
        `insert into "user" (name, email, email_verified)
         values ('Operations Owner', $1, true) returning id`,
        [`operations-${crypto.randomUUID()}@example.test`],
      );
      const ownerId = owner.rows[0]!.id;
      const home = await client.query<{ id: string }>(
        `insert into homes (owner_id, name, type, timezone)
         values ($1, 'Operations Home', 'HOUSE', 'UTC') returning id`,
        [ownerId],
      );
      const homeId = home.rows[0]!.id;
      await client.query(
        `insert into home_members (home_id, user_id, role)
         values ($1, $2, 'OWNER')`,
        [homeId, ownerId],
      );
      const firstAsset = await client.query<{ id: string }>(
        `insert into assets (home_id, name, category, created_by)
         values ($1, 'Old boiler', 'Heating', $2) returning id`,
        [homeId, ownerId],
      );
      const secondAsset = await client.query<{ id: string }>(
        `insert into assets (home_id, name, category, created_by)
         values ($1, 'New boiler', 'Heating', $2) returning id`,
        [homeId, ownerId],
      );
      const independentAsset = await client.query<{ id: string }>(
        `insert into assets (home_id, name, category, created_by)
         values ($1, 'Independent heater', 'Heating', $2) returning id`,
        [homeId, ownerId],
      );
      const task = await client.query<{ id: string }>(
        `insert into maintenance_tasks
          (home_id, asset_id, title, frequency_type, frequency_interval, next_due_at, created_by)
         values ($1, $2, 'Boiler checklist', 'YEARLY', 1, now(), $3)
         returning id`,
        [homeId, firstAsset.rows[0]!.id, ownerId],
      );
      const template = await client.query<{ id: string }>(
        `insert into maintenance_templates
          (home_id, created_by, title, category, frequency_type, frequency_interval, priority)
         values ($1, $2, 'Annual boiler service', 'Heating', 'YEARLY', 1, 'HIGH')
         returning id`,
        [homeId, ownerId],
      );

      await client.query(
        `insert into maintenance_task_checklist_items (task_id, title, sort_order)
         values ($1, 'Check pressure', 0)`,
        [task.rows[0]!.id],
      );
      await client.query(
        `insert into maintenance_template_checklist_items (template_id, title, sort_order)
         values ($1, 'Keep service certificate', 0)`,
        [template.rows[0]!.id],
      );
      await client.query(
        `insert into maintenance_recurrence_rules (task_id, rule)
         values ($1, '{"season":"AUTUMN","weekdays":[1]}'::jsonb)`,
        [task.rows[0]!.id],
      );

      const stock = await client.query<{ id: string; quantity: number }>(
        `insert into inventory_items
          (home_id, asset_id, name, quantity, reorder_threshold, created_by)
         values ($1, $2, 'Boiler filter', 2, 1, $3)
         returning id, quantity`,
        [homeId, firstAsset.rows[0]!.id, ownerId],
      );
      expect(stock.rows[0]!.quantity).toBe(2);

      await client.query(
        `insert into home_budgets
          (home_id, year, maintenance_budget, repair_budget, replacement_budget, created_by)
         values ($1, 2026, 500, 1000, 5000, $2)`,
        [homeId, ownerId],
      );
      await client.query(
        `insert into asset_replacement_links
          (home_id, predecessor_asset_id, successor_asset_id, replaced_at, created_by)
         values ($1, $2, $3, '2026-08-04', $4)`,
        [
          homeId,
          firstAsset.rows[0]!.id,
          secondAsset.rows[0]!.id,
          ownerId,
        ],
      );
      const insurance = await client.query<{ total: string }>(
        `insert into insurance_items
          (home_id, asset_id, name, category, quantity, unit_value, created_by)
         values ($1, $2, 'New boiler', 'Heating', 1, 4200, $3)
         returning (quantity * unit_value)::text as total`,
        [homeId, secondAsset.rows[0]!.id, ownerId],
      );
      expect(insurance.rows[0]!.total).toBe("4200.00");

      await client.query("savepoint invalid_replacement");
      let constraint: string | undefined;
      try {
        await client.query(
          `insert into asset_replacement_links
            (home_id, predecessor_asset_id, successor_asset_id, replaced_at, created_by)
           values ($1, $2, $2, '2026-08-04', $3)`,
          [homeId, independentAsset.rows[0]!.id, ownerId],
        );
      } catch (error) {
        constraint = (error as { code?: string }).code;
        await client.query("rollback to savepoint invalid_replacement");
      }
      expect(constraint).toBe("23514");
    });
  });
});
