import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, documents, homeMembers, rooms } from "@/db/schema";
import { AppError } from "@/src/server/errors";

function notFound(resource: string): never {
  throw new AppError("NOT_FOUND", `${resource} not found.`, 404);
}

export async function requireRoomInHome(roomId: string, homeId: string) {
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.homeId, homeId)))
    .limit(1);
  if (!room) notFound("Room");
  return room;
}

export async function requireAssetInHome(assetId: string, homeId: string) {
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.homeId, homeId)))
    .limit(1);
  if (!asset) notFound("Asset");
  return asset;
}

export async function requireMemberInHome(userId: string, homeId: string) {
  const [member] = await db
    .select({ id: homeMembers.id })
    .from(homeMembers)
    .where(
      and(eq(homeMembers.userId, userId), eq(homeMembers.homeId, homeId)),
    )
    .limit(1);
  if (!member) notFound("Home member");
  return member;
}

export async function requireDocumentInHome(
  documentId: string,
  homeId: string,
) {
  const [document] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.homeId, homeId)))
    .limit(1);
  if (!document) notFound("Document");
  return document;
}
