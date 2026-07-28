import { addDays, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import * as schema from "../db/schema";
import {
  account,
  assets,
  homeMembers,
  homes,
  maintenanceRecords,
  maintenanceTasks,
  notificationPreferences,
  notifications,
  rooms,
  user,
} from "../db/schema";

const demoEmail = "alex@homi.local";
const demoPassword = "HomiDemo!2026";
const pool = new Pool({
  connectionString:
    process.env.SEED_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://homi:homi@127.0.0.1:5432/homi",
});
const db = drizzle(pool, { schema });

try {
  let [demo] = await db.select().from(user).where(eq(user.email, demoEmail)).limit(1);
  if (!demo) {
    demo = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(user)
        .values({
          name: "Alex Morgan",
          email: demoEmail,
          emailVerified: true,
          onboardingStep: 5,
          onboardingCompletedAt: new Date(),
        })
        .returning();
      if (!created) throw new Error("Could not create demo user");
      await tx.insert(account).values({
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: await hashPassword(demoPassword),
      });
      return created;
    });
  }
  if (!demo) throw new Error("Could not create demo user");
  const existingHome = await db.select().from(homes).where(eq(homes.ownerId, demo.id)).limit(1);
  if (!existingHome.length) {
    await db.transaction(async (tx) => {
      const [home] = await tx.insert(homes).values({ ownerId: demo!.id, name: "Cedar House", type: "HOUSE", city: "Annecy", country: "France", constructionYear: 2018, timezone: "Europe/Paris" }).returning();
      if (!home) throw new Error("Could not seed home");
      await tx.insert(homeMembers).values({ homeId: home.id, userId: demo!.id, role: "OWNER", invitedBy: demo!.id });
      const roomRows = await tx.insert(rooms).values([
        { homeId: home.id, name: "Kitchen", floor: "Ground floor", icon: "Cooking" },
        { homeId: home.id, name: "Utility", floor: "Ground floor", icon: "Systems" },
        { homeId: home.id, name: "Living room", floor: "Ground floor", icon: "Living" },
        { homeId: home.id, name: "Garden", floor: "Outside", icon: "Exterior" },
      ]).returning();
      const kitchen = roomRows.find((room) => room.name === "Kitchen")!;
      const utility = roomRows.find((room) => room.name === "Utility")!;
      const assetRows = await tx.insert(assets).values([
        { homeId: home.id, roomId: kitchen.id, name: "Dishwasher", category: "Kitchen appliance", brand: "Miele", model: "G 7150", serialNumber: "DEMO-MIELE-7150", purchaseDate: "2024-09-18", warrantyEndDate: addDays(new Date(), 28).toISOString().slice(0, 10), createdBy: demo!.id },
        { homeId: home.id, roomId: utility.id, name: "Condensing boiler", category: "Heating", brand: "Viessmann", model: "Vitodens 100-W", installationDate: "2022-11-03", createdBy: demo!.id },
        { homeId: home.id, roomId: kitchen.id, name: "Extractor hood", category: "Kitchen appliance", brand: "Bosch", status: "NEEDS_ATTENTION", createdBy: demo!.id },
      ]).returning();
      const dishwasher = assetRows[0]!;
      const [overdue, upcoming] = await tx.insert(maintenanceTasks).values([
        { homeId: home.id, assetId: dishwasher.id, title: "Clean dishwasher filter", frequencyType: "MONTHLY", frequencyInterval: 1, nextDueAt: subDays(new Date(), 2), priority: "HIGH", estimatedDurationMinutes: 15, assignedTo: demo!.id, createdBy: demo!.id },
        { homeId: home.id, assetId: assetRows[1]!.id, title: "Check boiler pressure", frequencyType: "MONTHLY", frequencyInterval: 1, nextDueAt: addDays(new Date(), 5), priority: "MEDIUM", estimatedDurationMinutes: 5, assignedTo: demo!.id, createdBy: demo!.id },
        { homeId: home.id, title: "Test smoke alarms", frequencyType: "MONTHLY", frequencyInterval: 1, nextDueAt: addDays(new Date(), 12), priority: "HIGH", estimatedDurationMinutes: 10, assignedTo: demo!.id, createdBy: demo!.id },
      ]).returning();
      await tx.insert(maintenanceRecords).values({ idempotencyKey: crypto.randomUUID(), taskId: upcoming.id, assetId: upcoming.assetId, homeId: home.id, completedBy: demo!.id, completedAt: subDays(new Date(), 25), notes: "Pressure steady at 1.5 bar." });
      await tx.insert(notifications).values([
        { userId: demo!.id, homeId: home.id, type: "MAINTENANCE_OVERDUE", title: overdue.title, message: "This task is 2 days overdue.", actionUrl: `/maintenance/${overdue.id}` },
        { userId: demo!.id, homeId: home.id, type: "WARRANTY_EXPIRING", title: "Dishwasher warranty", message: "Expires in 28 days.", actionUrl: `/assets/${dishwasher.id}` },
      ]);
      await tx.insert(notificationPreferences).values({ userId: demo!.id, timezone: "Europe/Paris" });
    });
  }
  process.stdout.write(`Seed complete.\nDemo email: ${demoEmail}\nDemo password: ${demoPassword}\n`);
} finally {
  await pool.end();
}
