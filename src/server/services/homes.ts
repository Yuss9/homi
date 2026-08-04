import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db";
import { homeMembers, homes, rooms } from "../../../db/schema";
import { AppError } from "../errors";

export const homeInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40).default("HOUSE"),
  addressLine: z.string().trim().max(180).optional(),
  city: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(24).optional(),
  country: z.string().trim().max(80).optional(),
  constructionYear: z
    .number()
    .int()
    .min(1200)
    .max(new Date().getFullYear() + 2)
    .optional(),
  timezone: z.string().trim().min(1).max(80).default("UTC"),
});

export async function createHome(userId: string, raw: unknown) {
  const input = homeInput.parse(raw);
  return db.transaction(async (tx) => {
    const [home] = await tx
      .insert(homes)
      .values({ ...input, ownerId: userId })
      .returning();
    if (!home)
      throw new AppError("INTERNAL_ERROR", "Could not create the home.", 500);
    await tx.insert(homeMembers).values({
      homeId: home.id,
      userId,
      role: "OWNER",
      invitedBy: userId,
    });
    return home;
  });
}

export async function listHomes(userId: string) {
  return db
    .select({
      id: homes.id,
      name: homes.name,
      type: homes.type,
      addressLine: homes.addressLine,
      city: homes.city,
      postalCode: homes.postalCode,
      country: homes.country,
      constructionYear: homes.constructionYear,
      timezone: homes.timezone,
      createdAt: homes.createdAt,
      updatedAt: homes.updatedAt,
      role: homeMembers.role,
    })
    .from(homeMembers)
    .innerJoin(homes, eq(homes.id, homeMembers.homeId))
    .where(and(eq(homeMembers.userId, userId), isNull(homes.archivedAt)))
    .orderBy(homes.name);
}

export const roomInput = z.object({
  homeId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  floor: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(40).optional(),
});

export async function createRoom(raw: unknown) {
  const input = roomInput.parse(raw);
  const [room] = await db.insert(rooms).values(input).returning();
  return room;
}
