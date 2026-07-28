import "server-only";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db";
import { assets } from "../../../db/schema";

export const assetInput = z.object({
  homeId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  purchaseDate: z.string().date().optional(),
  warrantyEndDate: z.string().date().optional(),
  status: z.enum(["ACTIVE", "NEEDS_ATTENTION", "UNDER_REPAIR", "REPLACED", "ARCHIVED"]).default("ACTIVE"),
});

export async function createAsset(userId: string, raw: unknown) {
  const input = assetInput.parse(raw);
  const [asset] = await db.insert(assets).values({ ...input, createdBy: userId }).returning();
  return asset;
}

export async function listAssets(homeId: string, search?: string) {
  return db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.homeId, homeId),
        isNull(assets.archivedAt),
        search ? ilike(assets.name, `%${search.replaceAll("%", "\\%")}%`) : undefined,
      ),
    )
    .orderBy(assets.name)
    .limit(100);
}

